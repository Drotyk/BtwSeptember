import "dotenv/config";

export interface Settings {
  botToken: string;
  databaseUrl: string;
  webHost: string;
  webPort: number;
  chatInviteLink: string;
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

  const webPort = Number(process.env.WEB_PORT?.trim() || "3000");
  if (!Number.isInteger(webPort) || webPort < 1 || webPort > 65535) {
    throw new Error("WEB_PORT має бути цілим числом від 1 до 65535");
  }

  const webHost = process.env.WEB_HOST?.trim() || "127.0.0.1";
  const chatInviteLink = process.env.CHAT_INVITE_LINK?.trim() || "";

  return { botToken, databaseUrl: getDatabaseUrl(), webHost, webPort, chatInviteLink };
}
