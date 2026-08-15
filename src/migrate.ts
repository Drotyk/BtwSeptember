import { getDatabaseUrl } from "./config.js";
import { createPool } from "./db.js";
import { runMigrations } from "./migrations.js";

async function main(): Promise<void> {
  const pool = createPool(getDatabaseUrl());

  try {
    await runMigrations(pool);
    console.info("Міграції виконано успішно");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("Помилка виконання міграцій", error);
  process.exitCode = 1;
});
