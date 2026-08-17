import "dotenv/config";

export interface Settings {
  botToken: string;
  databaseUrl: string;
  webHost: string;
  webPort: number;
  chatInviteLink: string;
  privacyPolicyUrl: string;
  eventRulesUrl: string;
  privacyPolicyVersion: string;
  eventRulesVersion: string;
  adminUsername: string;
  adminPasswordHash: string;
  sessionTtlMs: number;
  adminSessionTtlMs: number;
  secureCookies: boolean;
  dropPendingUpdates: boolean;
  nodeEnvironment: "development" | "test" | "production";
}

function required(name: string): string {
  const value = process.env[name]?.trim() ?? "";
  if (!value) throw new Error(`Не задана обов'язкова змінна середовища: ${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number, minimum: number): number {
  const value = Number(process.env[name]?.trim() || String(fallback));
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} має бути цілим числом не менше ${minimum}`);
  }
  return value;
}

function booleanValue(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} має бути true або false`);
}

function urlValue(name: string): string {
  const value = required(name);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} має бути коректним URL`);
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`${name} має використовувати HTTP або HTTPS`);
  }

  return url.toString();
}

export function getDatabaseUrl(): string {
  return required("DATABASE_URL");
}

export function getSettings(): Settings {
  const nodeEnvironment = (process.env.NODE_ENV?.trim() ||
    "development") as Settings["nodeEnvironment"];
  if (!["development", "test", "production"].includes(nodeEnvironment)) {
    throw new Error("NODE_ENV має бути development, test або production");
  }

  const adminPasswordHash = required("ADMIN_PASSWORD_HASH");
  if (!adminPasswordHash.startsWith("$argon2id$")) {
    throw new Error("ADMIN_PASSWORD_HASH має бути Argon2id-хешем");
  }

  return {
    botToken: required("BOT_TOKEN"),
    databaseUrl: getDatabaseUrl(),
    webHost: process.env.WEB_HOST?.trim() || "127.0.0.1",
    webPort: positiveInteger("WEB_PORT", 3000, 1),
    chatInviteLink: process.env.CHAT_INVITE_LINK?.trim() || "",
    privacyPolicyUrl: urlValue("PRIVACY_POLICY_URL"),
    eventRulesUrl: urlValue("EVENT_RULES_URL"),
    privacyPolicyVersion: required("PRIVACY_POLICY_VERSION"),
    eventRulesVersion: required("EVENT_RULES_VERSION"),
    adminUsername: required("ADMIN_USERNAME"),
    adminPasswordHash,
    sessionTtlMs: positiveInteger("SESSION_TTL_SECONDS", 1800, 60) * 1000,
    adminSessionTtlMs: positiveInteger("ADMIN_SESSION_TTL_SECONDS", 3600, 300) * 1000,
    secureCookies: booleanValue("SECURE_COOKIES", nodeEnvironment === "production"),
    dropPendingUpdates: booleanValue("DROP_PENDING_UPDATES", false),
    nodeEnvironment,
  };
}
