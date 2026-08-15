import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Pool } from "pg";

const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const MIGRATIONS_DIRECTORY = resolve(process.cwd(), "migrations");

export async function runMigrations(
  pool: Pool,
  migrationsDirectory = MIGRATIONS_DIRECTORY,
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [847391]);
    await client.query(MIGRATIONS_TABLE);

    const migrationFiles = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      const alreadyApplied = await client.query(
        "SELECT 1 FROM schema_migrations WHERE version = $1",
        [file],
      );

      if ((alreadyApplied.rowCount ?? 0) > 0) continue;

      const sql = await readFile(join(migrationsDirectory, file), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
      console.info(`Міграцію застосовано: ${file}`);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
