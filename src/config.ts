import "dotenv/config";

export interface Settings {
  botToken: string;
  databaseUrl: string;
}

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) {
    throw new Error("Не задана обов'язкова змінна середовища: DATABASE_URL");
  }

  return databaseUrl;
}

export function getSettings(): Settings {
  const botToken = process.env.BOT_TOKEN?.trim() ?? "";
  if (!botToken) {
    throw new Error("Не задана обов'язкова змінна середовища: BOT_TOKEN");
  }

  return { botToken, databaseUrl: getDatabaseUrl() };
}
