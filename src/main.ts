import { createBot } from "./bot.js";
import { getSettings } from "./config.js";
import { createPool, initDb } from "./db.js";

async function main(): Promise<void> {
  const settings = getSettings();
  const pool = createPool(settings.databaseUrl);
  await initDb(pool);

  const bot = createBot(settings.botToken, pool);

  const shutdown = async (signal: string): Promise<void> => {
    console.info(`Отримано ${signal}, зупиняю бота...`);
    await bot.stop();
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
