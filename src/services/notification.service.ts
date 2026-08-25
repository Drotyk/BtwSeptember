export interface CreateNotificationInput {
  title: string;
  message: string;
  targetType: "all" | "training" | "user" | "custom";
  trainingId?: string;
  targetUserIds?: number[];
  scheduledAt: Date;
  expiresAt?: Date;
}

const VALID_TARGET_TYPES: readonly string[] = ["all", "training", "user", "custom"];

export function computeScheduledAt(eventAt: Date, offsetMinutes: number): Date {
  return new Date(eventAt.getTime() - offsetMinutes * 60_000);
}

export function formatScheduleDisplay(date: Date): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(date);
}

export function isInPast(date: Date): boolean {
  return date.getTime() < Date.now() - 60_000;
}

export function validateNotificationInput(input: CreateNotificationInput): string | null {
  const title = input.title.trim();
  if (!title || title.length > 200) return "Заголовок обов'язковий (до 200 символів)";

  const message = input.message.trim();
  if (!message || message.length > 4000)
    return "Текст повідомлення обов'язковий (до 4000 символів)";

  if (!VALID_TARGET_TYPES.includes(input.targetType)) return "Невірний тип аудиторії";

  if (input.targetType === "training" && !input.trainingId?.trim()) {
    return "Тренінг обов'язковий для цього типу аудиторії";
  }

  if (
    (input.targetType === "user" || input.targetType === "custom") &&
    (!Array.isArray(input.targetUserIds) || input.targetUserIds.length === 0)
  ) {
    return "Потрібно вказати хоча б одного отримувача";
  }

  if (isNaN(input.scheduledAt.getTime())) return "Невірна дата відправки";
  if (isInPast(input.scheduledAt)) return "Дата відправки не може бути в минулому";

  if (input.expiresAt !== undefined) {
    if (isNaN(input.expiresAt.getTime())) return "Невірна дата закінчення";
    if (input.expiresAt <= input.scheduledAt)
      return "Дата закінчення має бути після дати відправки";
  }

  return null;
}
