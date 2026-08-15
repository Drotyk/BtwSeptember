const UKRAINIAN_PHONE_PATTERN = /^(?:\+380|380|0)[0-9]{9}$/;
const NAME_PART_PATTERN = /^\p{L}+(?:[-'’ʼ]\p{L}+)*$/u;

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

export function validateAge(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;

  const age = Number(normalized);
  return Number.isInteger(age) && age >= 1 && age <= 120 ? age : null;
}
