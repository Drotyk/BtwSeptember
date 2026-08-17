import type { Server } from "node:http";

import { createBot } from "./bot.js";
import { getSettings } from "./config.js";
import { deleteExpiredSessions } from "./repositories/sessions.repository.js";
import { createPool } from "./db.js";
import { migrationsAreApplied, runMigrations } from "./migrations.js";
import { startWebServer, stopWebServer } from "./web.js";

async function main(): Promise<void> {
  const settings = getSettings();
  const pool = createPool(settings.databaseUrl);
  let webServer: Server | undefined;
  let botStarted = false;
  let botReady = false;
  let migrationsReady = false;
  let shuttingDown = false;
  const bot = createBot(settings, pool);
  const cleanupInterval = setInterval(
    () => {
      void deleteExpiredSessions(pool).catch(() => undefined);
    },
    15 * 60 * 1000,
  );
  cleanupInterval.unref();

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    botReady = false;
    console.info(`Отримано ${signal}, зупиняю BTW...`);
    clearInterval(cleanupInterval);
    try {
      if (botStarted) await bot.stop();
    } catch {
      // Shutdown must continue even if Telegram is unavailable.
    }
    if (webServer) {
      try {
        await stopWebServer(webServer);
      } catch {
        // The process is already shutting down.
      }
    }
    await pool.end();
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await runMigrations(pool);
    migrationsReady = true;
    webServer = await startWebServer(pool, settings, async () => {
      if (!migrationsReady || !botReady) return false;
      try {
        await pool.query("SELECT 1");
        return await migrationsAreApplied(pool);
      } catch {
        return false;
      }
    });

    await bot.init();
    await bot.api.deleteWebhook({ drop_pending_updates: settings.dropPendingUpdates });
    botReady = true;
    botStarted = true;
    await bot.start({
      onStart: (botInfo) => {
        console.info(`BTW bot @${botInfo.username} готовий`);
      },
    });
  } finally {
    await shutdown("FINALLY");
  }
}

main().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  console.error("BTW не вдалося запустити", { errorName });
  process.exitCode = 1;
});
