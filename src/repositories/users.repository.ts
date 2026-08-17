import type { Pool } from "pg";

export interface ConsentRecord {
  personalDataPolicyVersion: string;
  eventRulesVersion: string;
}

export interface UserRecord {
  id: string;
  telegramUserId: string;
  phoneNumber: string;
  name: string;
  telegramUsername: string | null;
  institution: string | null;
  course: string | null;
  trainingIds: string[] | null;
  trainings: string[] | null;
  discoverySource: string | null;
  personalDataConsent: boolean;
  personalDataConsentAt: Date | null;
  personalDataPolicyVersion: string | null;
  eventRulesConsent: boolean;
  eventRulesConsentAt: Date | null;
  eventRulesVersion: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRepository {
  exists(telegramUserId: number): Promise<boolean>;
  findByTelegramUserId(telegramUserId: number): Promise<UserRecord | null>;
  save(input: {
    telegramUserId: number;
    phoneNumber: string;
    name: string;
    telegramUsername: string | null;
    institution: string;
    course: string;
    trainingIds: string[];
    trainings: string[];
    discoverySource: string;
    consent: ConsentRecord;
  }): Promise<void>;
  deleteByTelegramUserId(telegramUserId: number): Promise<boolean>;
  list(input: { page: number; pageSize: number; search: string }): Promise<{
    users: UserRecord[];
    total: number;
  }>;
}

const USER_COLUMNS = `
  id,
  telegram_user_id AS "telegramUserId",
  phone_number AS "phoneNumber",
  full_name AS name,
  telegram_username AS "telegramUsername",
  institution,
  course,
  training_ids AS "trainingIds",
  trainings,
  discovery_source AS "discoverySource",
  personal_data_consent AS "personalDataConsent",
  personal_data_consent_at AS "personalDataConsentAt",
  personal_data_policy_version AS "personalDataPolicyVersion",
  event_rules_consent AS "eventRulesConsent",
  event_rules_consent_at AS "eventRulesConsentAt",
  event_rules_version AS "eventRulesVersion",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export function createUsersRepository(pool: Pool): UserRepository {
  return {
    async exists(telegramUserId) {
      const result = await pool.query("SELECT 1 FROM users WHERE telegram_user_id = $1 LIMIT 1", [
        telegramUserId,
      ]);
      return (result.rowCount ?? 0) > 0;
    },

    async findByTelegramUserId(telegramUserId) {
      const result = await pool.query<UserRecord>(
        `SELECT ${USER_COLUMNS} FROM users WHERE telegram_user_id = $1 LIMIT 1`,
        [telegramUserId],
      );
      return result.rows[0] ?? null;
    },

    async save(input) {
      await pool.query(
        `
        INSERT INTO users (
          telegram_user_id, phone_number, full_name, telegram_username,
          institution, course, training_ids, trainings, discovery_source,
          personal_data_consent, personal_data_consent_at,
          personal_data_policy_version, event_rules_consent,
          event_rules_consent_at, event_rules_version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, NOW(), $10, TRUE, NOW(), $11)
        ON CONFLICT (telegram_user_id) DO UPDATE SET
          phone_number = EXCLUDED.phone_number,
          full_name = EXCLUDED.full_name,
          telegram_username = EXCLUDED.telegram_username,
          institution = EXCLUDED.institution,
          course = EXCLUDED.course,
          training_ids = EXCLUDED.training_ids,
          trainings = EXCLUDED.trainings,
          discovery_source = EXCLUDED.discovery_source,
          personal_data_consent = EXCLUDED.personal_data_consent,
          personal_data_consent_at = EXCLUDED.personal_data_consent_at,
          personal_data_policy_version = EXCLUDED.personal_data_policy_version,
          event_rules_consent = EXCLUDED.event_rules_consent,
          event_rules_consent_at = EXCLUDED.event_rules_consent_at,
          event_rules_version = EXCLUDED.event_rules_version,
          updated_at = NOW()
        `,
        [
          input.telegramUserId,
          input.phoneNumber,
          input.name,
          input.telegramUsername,
          input.institution,
          input.course,
          input.trainingIds,
          input.trainings,
          input.discoverySource,
          input.consent.personalDataPolicyVersion,
          input.consent.eventRulesVersion,
        ],
      );
    },

    async deleteByTelegramUserId(telegramUserId) {
      const result = await pool.query("DELETE FROM users WHERE telegram_user_id = $1", [
        telegramUserId,
      ]);
      return (result.rowCount ?? 0) > 0;
    },

    async list({ page, pageSize, search }) {
      const offset = (page - 1) * pageSize;
      const condition = `
        $1 = ''
        OR phone_number ILIKE '%' || $1 || '%'
        OR full_name ILIKE '%' || $1 || '%'
        OR COALESCE(telegram_username, '') ILIKE '%' || $1 || '%'
        OR COALESCE(institution, '') ILIKE '%' || $1 || '%'
        OR COALESCE(course, '') ILIKE '%' || $1 || '%'
        OR COALESCE(array_to_string(trainings, ' '), '') ILIKE '%' || $1 || '%'
        OR COALESCE(array_to_string(training_ids, ' '), '') ILIKE '%' || $1 || '%'
        OR COALESCE(discovery_source, '') ILIKE '%' || $1 || '%'
        OR telegram_user_id::text ILIKE '%' || $1 || '%'
      `;
      const [countResult, usersResult] = await Promise.all([
        pool.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count FROM users WHERE ${condition}`,
          [search],
        ),
        pool.query<UserRecord>(
          `
          SELECT ${USER_COLUMNS}
          FROM users
          WHERE ${condition}
          ORDER BY created_at DESC, id DESC
          LIMIT $2 OFFSET $3
          `,
          [search, pageSize, offset],
        ),
      ]);

      return {
        users: usersResult.rows,
        total: Number(countResult.rows[0]?.count ?? 0),
      };
    },
  };
}
