const UKRAINIAN_PHONE_PATTERN = /^(?:\+380|380|0)[0-9]{9}$/;
const NAME_PART_PATTERN = /^\p{L}+(?:[-'’ʼ]\p{L}+)*$/u;
const TELEGRAM_USERNAME_PATTERN = /^[A-Za-z0-9_]{5,32}$/;

export function normalizePhone(value: string): string | null {
  const normalized = value.trim().replace(/[\s()-]/g, "");
  if (!UKRAINIAN_PHONE_PATTERN.test(normalized)) return null;

  const digits = normalized.startsWith("0")
    ? `380${normalized.slice(1)}`
    : normalized.replace(/^\+/, "");

  return `+${digits}`;
}

export function validateName(value: string): string | null {
  const normalized = value.trim().split(/\s+/).join(" ");
  if (normalized.length < 2 || normalized.length > 100) return null;

  const parts = normalized.split(" ");
  if (parts.length !== 2 || parts.some((part) => !NAME_PART_PATTERN.test(part))) {
    return null;
  }

  return normalized;
}

export function normalizeTelegramUsername(value: string): string | null {
  const normalized = value.trim().replace(/^@/, "");
  if (!TELEGRAM_USERNAME_PATTERN.test(normalized)) return null;

  return `@${normalized}`;
}

export function validateCustomAnswer(value: string, maxLength = 100): string | null {
  const normalized = value.trim().split(/\s+/).join(" ");
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}
