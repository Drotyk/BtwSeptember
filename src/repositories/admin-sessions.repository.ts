import type { Pool } from "pg";

export interface AdminSessionRepository {
  create(tokenHash: string, expiresAt: Date): Promise<void>;
  findValid(tokenHash: string): Promise<boolean>;
  touch(tokenHash: string, expiresAt: Date): Promise<void>;
  delete(tokenHash: string): Promise<void>;
}

export function createAdminSessionsRepository(pool: Pool): AdminSessionRepository {
  return {
    async create(tokenHash, expiresAt) {
      await pool.query("INSERT INTO admin_sessions (token_hash, expires_at) VALUES ($1, $2)", [
        tokenHash,
        expiresAt,
      ]);
    },

    async findValid(tokenHash) {
      const result = await pool.query(
        "SELECT 1 FROM admin_sessions WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1",
        [tokenHash],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async touch(tokenHash, expiresAt) {
      await pool.query(
        "UPDATE admin_sessions SET last_accessed_at = NOW(), expires_at = $2 WHERE token_hash = $1",
        [tokenHash, expiresAt],
      );
    },

    async delete(tokenHash) {
      await pool.query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
    },
  };
}
