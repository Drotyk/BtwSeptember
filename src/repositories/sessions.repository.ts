import type { Context } from "grammy";
import type { Pool } from "pg";
import type { StorageAdapter } from "grammy";

import type { SessionData } from "../bot/types.js";

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

export async function deleteExpiredSessions(pool: Pool): Promise<void> {
  await pool.query("DELETE FROM bot_sessions WHERE expires_at <= NOW()");
  await pool.query("DELETE FROM admin_sessions WHERE expires_at <= NOW()");
}
