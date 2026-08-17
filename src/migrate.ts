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
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorCode =
    typeof error === "object" && error !== null && "code" in error ? String(error.code) : undefined;
  const syscall =
    typeof error === "object" && error !== null && "syscall" in error
      ? String(error.syscall)
      : undefined;
  console.error("Помилка виконання міграцій", { errorName, errorCode, syscall });
  process.exitCode = 1;
});
