import "dotenv/config";

export interface Settings {
  botToken: string;
  databaseUrl: string;
}

export function getSettings(): Settings {
  const botToken = process.env.BOT_TOKEN?.trim() ?? "";
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const missing: string[] = [];

  if (!botToken) missing.push("BOT_TOKEN");
  if (!databaseUrl) missing.push("DATABASE_URL");

  if (missing.length > 0) {
    throw new Error(`Не задані обов'язкові змінні середовища: ${missing.join(", ")}`);
  }

  return { botToken, databaseUrl };
}
