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
      const columns = await pool.query<{ column_name: string }>(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name IN ('event_rules_consent_at', 'event_rules_version')
        `,
      );
      expect(columns.rows.map((row) => row.column_name).sort()).toEqual([
        "event_rules_consent_at",
        "event_rules_version",
      ]);
      const speakerColumns = await pool.query<{ column_name: string }>(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'speakers'
          AND column_name = 'detailed_description'
        `,
      );
      expect(speakerColumns.rows.map((row) => row.column_name)).toEqual(["detailed_description"]);
    } finally {
      await pool.end();
    }
  });
});
