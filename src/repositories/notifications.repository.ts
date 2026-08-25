import type { Pool, PoolClient } from "pg";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  trainingId: string | null;
  targetType: string;
  targetUserIds: string[] | null;
  scheduledAt: Date;
  expiresAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  sentAt: Date | null;
}

export interface NotificationWithCounts extends NotificationRecord {
  totalDeliveries: number;
  sentCount: number;
  failedCount: number;
  blockedCount: number;
  pendingCount: number;
}

export interface DeliveryRecord {
  id: string;
  notificationId: string;
  userId: string;
  telegramId: string;
  status: string;
  attempts: number;
  sentAt: Date | null;
  lastAttemptAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  userName: string | null;
  userTelegram: string | null;
}

export interface NotificationDetail extends NotificationWithCounts {
  deliveries: DeliveryRecord[];
}

export interface NotificationsRepository {
  create(input: {
    title: string;
    message: string;
    trainingId: string | null;
    targetType: string;
    targetUserIds: number[] | null;
    scheduledAt: Date;
    expiresAt: Date | null;
  }): Promise<NotificationRecord>;

  findById(id: number): Promise<NotificationDetail | null>;

  list(page: number, pageSize: number): Promise<{
    notifications: NotificationWithCounts[];
    total: number;
  }>;

  cancel(id: number): Promise<boolean>;

  retryFailed(id: number): Promise<number>;

  countRecipients(
    targetType: string,
    trainingId: string | null,
    targetUserIds: number[] | null,
  ): Promise<number>;

  createDeliveries(
    notificationId: number,
    targetType: string,
    trainingId: string | null,
    targetUserIds: number[] | null,
  ): Promise<number>;

  fetchPendingNotifications(): Promise<NotificationRecord[]>;

  fetchPendingDeliveries(
    notificationId: number,
    batchSize: number,
  ): Promise<Array<{ id: string; telegramId: string; notificationId: string; attempts: number }>>;

  markDeliveryResult(
    deliveryId: number,
    status: "sent" | "failed" | "blocked" | "pending",
    error?: string,
  ): Promise<void>;

  finalizeNotification(notificationId: number): Promise<void>;

  expireOverdueNotifications(): Promise<number>;
}

// ─── Notification columns ───────────────────────────────────────────────────

const NOTIFICATION_COLUMNS = `
  id,
  title,
  message,
  training_id AS "trainingId",
  target_type AS "targetType",
  target_user_ids AS "targetUserIds",
  scheduled_at AS "scheduledAt",
  expires_at AS "expiresAt",
  status,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  sent_at AS "sentAt"
`;

// ─── Recipient query builder ────────────────────────────────────────────────

function recipientCondition(
  targetType: string,
  trainingId: string | null,
  targetUserIds: number[] | null,
): { where: string; params: unknown[] } {
  switch (targetType) {
    case "training":
      return {
        where: "WHERE $1 = ANY(training_ids)",
        params: [trainingId],
      };
    case "user":
    case "custom":
      return {
        where: "WHERE telegram_user_id = ANY($1::bigint[])",
        params: [targetUserIds],
      };
    default:
      return { where: "", params: [] };
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createNotificationsRepository(pool: Pool): NotificationsRepository {
  return {
    async create(input) {
      const result = await pool.query<NotificationRecord>(
        `INSERT INTO notifications
           (title, message, training_id, target_type, target_user_ids, scheduled_at, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${NOTIFICATION_COLUMNS}`,
        [
          input.title,
          input.message,
          input.trainingId,
          input.targetType,
          input.targetUserIds,
          input.scheduledAt,
          input.expiresAt,
        ],
      );
      return result.rows[0];
    },

    async findById(id) {
      const notifResult = await pool.query<NotificationWithCounts>(
        `SELECT
           n.id, n.title, n.message,
           n.training_id AS "trainingId",
           n.target_type AS "targetType",
           n.target_user_ids AS "targetUserIds",
           n.scheduled_at AS "scheduledAt",
           n.expires_at AS "expiresAt",
           n.status,
           n.created_at AS "createdAt",
           n.updated_at AS "updatedAt",
           n.sent_at AS "sentAt",
           COALESCE(agg.total, 0)::int AS "totalDeliveries",
           COALESCE(agg.sent, 0)::int AS "sentCount",
           COALESCE(agg.failed, 0)::int AS "failedCount",
           COALESCE(agg.blocked, 0)::int AS "blockedCount",
           COALESCE(agg.pending, 0)::int AS "pendingCount"
         FROM notifications n
         LEFT JOIN LATERAL (
           SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE d.status = 'sent') AS sent,
             COUNT(*) FILTER (WHERE d.status = 'failed') AS failed,
             COUNT(*) FILTER (WHERE d.status = 'blocked') AS blocked,
             COUNT(*) FILTER (WHERE d.status = 'pending') AS pending
           FROM notification_deliveries d
           WHERE d.notification_id = n.id
         ) agg ON TRUE
         WHERE n.id = $1`,
        [id],
      );

      const notification = notifResult.rows[0];
      if (!notification) return null;

      const deliveriesResult = await pool.query<DeliveryRecord>(
        `SELECT
           d.id,
           d.notification_id AS "notificationId",
           d.user_id AS "userId",
           d.telegram_id AS "telegramId",
           d.status,
           d.attempts,
           d.sent_at AS "sentAt",
           d.last_attempt_at AS "lastAttemptAt",
           d.last_error AS "lastError",
           d.created_at AS "createdAt",
           d.updated_at AS "updatedAt",
           u.full_name AS "userName",
           u.telegram_username AS "userTelegram"
         FROM notification_deliveries d
         LEFT JOIN users u ON u.id = d.user_id
         WHERE d.notification_id = $1
         ORDER BY d.created_at`,
        [id],
      );

      return { ...notification, deliveries: deliveriesResult.rows };
    },

    async list(page, pageSize) {
      const offset = (page - 1) * pageSize;
      const [countResult, listResult] = await Promise.all([
        pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM notifications"),
        pool.query<NotificationWithCounts>(
          `SELECT
             n.id, n.title, n.message,
             n.training_id AS "trainingId",
             n.target_type AS "targetType",
             n.target_user_ids AS "targetUserIds",
             n.scheduled_at AS "scheduledAt",
             n.expires_at AS "expiresAt",
             n.status,
             n.created_at AS "createdAt",
             n.updated_at AS "updatedAt",
             n.sent_at AS "sentAt",
             COALESCE(agg.total, 0)::int AS "totalDeliveries",
             COALESCE(agg.sent, 0)::int AS "sentCount",
             COALESCE(agg.failed, 0)::int AS "failedCount",
             COALESCE(agg.blocked, 0)::int AS "blockedCount",
             COALESCE(agg.pending, 0)::int AS "pendingCount"
           FROM notifications n
           LEFT JOIN LATERAL (
             SELECT
               COUNT(*) AS total,
               COUNT(*) FILTER (WHERE d.status = 'sent') AS sent,
               COUNT(*) FILTER (WHERE d.status = 'failed') AS failed,
               COUNT(*) FILTER (WHERE d.status = 'blocked') AS blocked,
               COUNT(*) FILTER (WHERE d.status = 'pending') AS pending
             FROM notification_deliveries d
             WHERE d.notification_id = n.id
           ) agg ON TRUE
           ORDER BY n.created_at DESC, n.id DESC
           LIMIT $1 OFFSET $2`,
          [pageSize, offset],
        ),
      ]);

      return {
        notifications: listResult.rows,
        total: Number(countResult.rows[0]?.count ?? 0),
      };
    },

    async cancel(id) {
      const result = await pool.query(
        `UPDATE notifications
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = $1 AND status IN ('pending', 'processing')`,
        [id],
      );
      if ((result.rowCount ?? 0) > 0) {
        await pool.query(
          `UPDATE notification_deliveries
           SET status = 'failed', last_error = 'Оповіщення скасовано', updated_at = NOW()
           WHERE notification_id = $1 AND status = 'pending'`,
          [id],
        );
      }
      return (result.rowCount ?? 0) > 0;
    },

    async retryFailed(id) {
      const result = await pool.query(
        `UPDATE notification_deliveries
         SET status = 'pending', attempts = 0, last_error = NULL, updated_at = NOW()
         WHERE notification_id = $1 AND status = 'failed'`,
        [id],
      );
      const retried = result.rowCount ?? 0;
      if (retried > 0) {
        await pool.query(
          `UPDATE notifications
           SET status = 'pending', updated_at = NOW()
           WHERE id = $1 AND status IN ('partially_sent', 'failed')`,
          [id],
        );
      }
      return retried;
    },

    async countRecipients(targetType, trainingId, targetUserIds) {
      const { where, params } = recipientCondition(targetType, trainingId, targetUserIds);
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users ${where}`,
        params,
      );
      return Number(result.rows[0]?.count ?? 0);
    },

    async createDeliveries(notificationId, targetType, trainingId, targetUserIds) {
      const { where, params } = recipientCondition(targetType, trainingId, targetUserIds);
      const paramOffset = params.length;
      const result = await pool.query(
        `INSERT INTO notification_deliveries (notification_id, user_id, telegram_id)
         SELECT $${paramOffset + 1}, u.id, u.telegram_user_id
         FROM users u
         ${where}
         ON CONFLICT (notification_id, user_id) DO NOTHING`,
        [...params, notificationId],
      );
      return result.rowCount ?? 0;
    },

    async fetchPendingNotifications() {
      const client: PoolClient = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<NotificationRecord>(
          `SELECT ${NOTIFICATION_COLUMNS}
           FROM notifications
           WHERE status = 'pending' AND scheduled_at <= NOW()
           FOR UPDATE SKIP LOCKED
           LIMIT 10`,
        );

        if (result.rows.length > 0) {
          const ids = result.rows.map((r) => r.id);
          await client.query(
            `UPDATE notifications
             SET status = 'processing', updated_at = NOW()
             WHERE id = ANY($1::bigint[])`,
            [ids],
          );
        }

        await client.query("COMMIT");
        return result.rows;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async fetchPendingDeliveries(notificationId, batchSize) {
      const client: PoolClient = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await client.query<{
          id: string;
          telegramId: string;
          notificationId: string;
          attempts: number;
        }>(
          `SELECT
             id,
             telegram_id AS "telegramId",
             notification_id AS "notificationId",
             attempts
           FROM notification_deliveries
           WHERE notification_id = $1 AND status = 'pending'
           FOR UPDATE SKIP LOCKED
           LIMIT $2`,
          [notificationId, batchSize],
        );
        await client.query("COMMIT");
        return result.rows;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    async markDeliveryResult(deliveryId, status, error) {
      const sentAt = status === "sent" ? "NOW()" : "sent_at";
      await pool.query(
        `UPDATE notification_deliveries
         SET status = $2,
             attempts = attempts + 1,
             last_attempt_at = NOW(),
             last_error = $3,
             sent_at = ${sentAt},
             updated_at = NOW()
         WHERE id = $1`,
        [deliveryId, status, error ?? null],
      );
    },

    async finalizeNotification(notificationId) {
      const result = await pool.query<{
        total: string;
        sent: string;
        failed: string;
        blocked: string;
        pending: string;
      }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'sent') AS sent,
           COUNT(*) FILTER (WHERE status = 'failed') AS failed,
           COUNT(*) FILTER (WHERE status = 'blocked') AS blocked,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending
         FROM notification_deliveries
         WHERE notification_id = $1`,
        [notificationId],
      );

      const { total, sent, failed, blocked, pending } = result.rows[0];
      const totalNum = Number(total);
      const pendingNum = Number(pending);
      const sentNum = Number(sent);
      const failedNum = Number(failed);
      const blockedNum = Number(blocked);

      if (pendingNum > 0) return; // Still has pending deliveries

      let newStatus: string;
      if (totalNum === 0) {
        newStatus = "sent";
      } else if (sentNum === totalNum) {
        newStatus = "sent";
      } else if (failedNum + blockedNum === totalNum) {
        newStatus = "failed";
      } else {
        newStatus = "partially_sent";
      }

      await pool.query(
        `UPDATE notifications
         SET status = $2, sent_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND status = 'processing'`,
        [notificationId, newStatus],
      );
    },

    async expireOverdueNotifications() {
      const result = await pool.query(
        `UPDATE notifications
         SET status = 'expired', updated_at = NOW()
         WHERE expires_at <= NOW() AND status IN ('pending', 'processing')`,
      );
      return result.rowCount ?? 0;
    },
  };
}
