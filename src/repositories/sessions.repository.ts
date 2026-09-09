import type { Context } from "grammy";
import type { Pool } from "pg";
import type { StorageAdapter } from "grammy";

import type { SessionData } from "../bot/types.js";

export interface IncompleteRegistrationRecord {
  telegramUserId: number;
  telegramUsername: string | null;
  step: string;
  updatedAt: Date;
  expiresAt: Date;
}

export function privateSessionKey(ctx: Pick<Context, "chat" | "from">): string | undefined {
  if (ctx.chat?.type !== "private" || !ctx.from) return undefined;
  return `telegram:${ctx.from.id}`;
}

export function createSessionStorage(pool: Pool, ttlMs: number): StorageAdapter<SessionData> {
  return {
    async read(key) {
      const result = await pool.query<{ data: SessionData }>(
        "SELECT data FROM bot_sessions WHERE session_key = $1 AND expires_at > NOW()",
        [key],
      );
      if (result.rows[0]) return result.rows[0].data;

      await pool.query("DELETE FROM bot_sessions WHERE session_key = $1 AND expires_at <= NOW()", [
        key,
      ]);
      return undefined;
    },

    async write(key, value) {
      await pool.query(
        `
        INSERT INTO bot_sessions (session_key, data, created_at, updated_at, expires_at)
        VALUES ($1, $2::jsonb, NOW(), NOW(), NOW() + ($3 * INTERVAL '1 millisecond'))
        ON CONFLICT (session_key) DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = NOW(),
          expires_at = EXCLUDED.expires_at
        `,
        [key, JSON.stringify(value), ttlMs],
      );
    },

    async delete(key) {
      await pool.query("DELETE FROM bot_sessions WHERE session_key = $1", [key]);
    },
  };
}

export async function listIncompleteRegistrations(
  pool: Pool,
): Promise<IncompleteRegistrationRecord[]> {
  const result = await pool.query<IncompleteRegistrationRecord>(
    `
      SELECT
        substring(s.session_key FROM 10)::bigint AS "telegramUserId",
        NULLIF(s.data->>'telegramUsername', '') AS "telegramUsername",
        s.data->'registration'->>'step' AS step,
        s.updated_at AS "updatedAt",
        s.expires_at AS "expiresAt"
      FROM bot_sessions s
      WHERE s.session_key LIKE 'telegram:%'
        AND s.data ? 'registration'
        AND s.expires_at > NOW()
        AND NOT EXISTS (
          SELECT 1
          FROM users u
          WHERE u.telegram_user_id = substring(s.session_key FROM 10)::bigint
        )
      ORDER BY s.updated_at DESC
    `,
  );
  return result.rows;
}

export async function deleteExpiredSessions(pool: Pool): Promise<void> {
  await pool.query("DELETE FROM bot_sessions WHERE expires_at <= NOW()");
  await pool.query("DELETE FROM admin_sessions WHERE expires_at <= NOW()");
}
