import { createBot } from "./bot.js";
import { getSettings } from "./config.js";
import { createPool } from "./db.js";
import { runMigrations } from "./migrations.js";
import { startWebServer, stopWebServer } from "./web.js";

async function main(): Promise<void> {
  const settings = getSettings();
  const pool = createPool(settings.databaseUrl);
  await runMigrations(pool);

  const bot = createBot(settings.botToken, pool);
  const webServer = await startWebServer(pool, settings.webHost, settings.webPort);

  const shutdown = async (signal: string): Promise<void> => {
    console.info(`Отримано ${signal}, зупиняю бота...`);
    await bot.stop();
    await stopWebServer(webServer);
    await pool.end();
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await bot.api.deleteWebhook({ drop_pending_updates: true });
  await bot.start({
    onStart: (botInfo) => {
      console.info(`Бот @${botInfo.username} запущений`);
    },
  });
}

main().catch((error: unknown) => {
  console.error("Критична помилка запуску", error);
  process.exitCode = 1;
});
