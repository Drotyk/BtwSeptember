import { describe, expect, it } from "vitest";
import { createPool } from "../src/db.js";
import { migrationsAreApplied, runMigrations } from "../src/migrations.js";

const integration = process.env.DATABASE_URL ? describe : describe.skip;

integration("PostgreSQL migrations", () => {
  it("applies every migration on a clean service database", async () => {
    const pool = createPool(process.env.DATABASE_URL as string);
    try {
      await runMigrations(pool);
      expect(await migrationsAreApplied(pool)).toBe(true);
      const result = await pool.query<{ session_table: string | null }>(
        "SELECT to_regclass('public.bot_sessions') AS session_table",
      );
      expect(result.rows[0]?.session_table).toBe("bot_sessions");
    } finally {
      await pool.end();
    }
  });
});
