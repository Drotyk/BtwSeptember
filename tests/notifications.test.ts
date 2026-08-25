import { describe, expect, it } from "vitest";
import {
  computeScheduledAt,
  formatScheduleDisplay,
  isInPast,
  validateNotificationInput,
} from "../src/services/notification.service.js";

describe("notification.service", () => {
  describe("computeScheduledAt", () => {
    it("subtracts 1440 min (24h) before event", () => {
      const eventAt = new Date("2026-08-25T10:00:00Z");
      const expected = new Date("2026-08-24T10:00:00Z");
      expect(computeScheduledAt(eventAt, 1440).getTime()).toBe(expected.getTime());
    });

    it("subtracts 120 min (2h) before event", () => {
      const eventAt = new Date("2026-08-25T10:00:00Z");
      const expected = new Date("2026-08-25T08:00:00Z");
      expect(computeScheduledAt(eventAt, 120).getTime()).toBe(expected.getTime());
    });

    it("subtracts 15 min before event", () => {
      const eventAt = new Date("2026-08-25T10:00:00Z");
      const expected = new Date("2026-08-25T09:45:00Z");
      expect(computeScheduledAt(eventAt, 15).getTime()).toBe(expected.getTime());
    });

    it("0 offset returns same time", () => {
      const eventAt = new Date("2026-08-25T10:00:00Z");
      expect(computeScheduledAt(eventAt, 0).getTime()).toBe(eventAt.getTime());
    });
  });

  describe("formatScheduleDisplay", () => {
    it("formats dates in Europe/Kyiv timezone", () => {
      // 2026-08-24T12:00:00Z is 15:00:00 in Kyiv (EEST, UTC+3) in summer
      const date = new Date("2026-08-24T12:00:00Z");
      const formatted = formatScheduleDisplay(date);
      // The exact format might vary slightly depending on Node version, but usually it's "24.08.2026, 15:00" or similar.
      // We check that it contains the expected parts.
      expect(formatted).toContain("24.08.2026");
      expect(formatted).toContain("15:00");
    });
  });

  describe("isInPast", () => {
    it("returns true for date > 60s in the past", () => {
      const pastDate = new Date(Date.now() - 61_000);
      expect(isInPast(pastDate)).toBe(true);
    });

    it("returns false for current date (within tolerance)", () => {
      const currentDate = new Date(Date.now());
      expect(isInPast(currentDate)).toBe(false);
    });

    it("returns false for future date", () => {
      const futureDate = new Date(Date.now() + 60_000);
      expect(isInPast(futureDate)).toBe(false);
    });
  });

  describe("validateNotificationInput", () => {
    const validBaseInput = {
      title: "Test Title",
      message: "Test Message",
      targetType: "all" as const,
      scheduledAt: new Date(Date.now() + 3600_000), // 1 hour in the future
    };

    it("returns null for valid input", () => {
      expect(validateNotificationInput(validBaseInput)).toBeNull();
    });

    it("returns error for empty title", () => {
      expect(validateNotificationInput({ ...validBaseInput, title: "   " })).toBe("Заголовок обов'язковий (до 200 символів)");
    });

    it("returns error for title > 200 chars", () => {
      const longTitle = "a".repeat(201);
      expect(validateNotificationInput({ ...validBaseInput, title: longTitle })).toBe("Заголовок обов'язковий (до 200 символів)");
    });

    it("returns error for empty message", () => {
      expect(validateNotificationInput({ ...validBaseInput, message: "" })).toBe("Текст повідомлення обов'язковий (до 4000 символів)");
    });

    it("returns error for message > 4000 chars", () => {
      const longMessage = "a".repeat(4001);
      expect(validateNotificationInput({ ...validBaseInput, message: longMessage })).toBe("Текст повідомлення обов'язковий (до 4000 символів)");
    });

    it("returns error for invalid targetType", () => {
      expect(validateNotificationInput({ ...validBaseInput, targetType: "invalid" as unknown as "all" })).toBe("Невірний тип аудиторії");
    });

    it("returns error when training targetType without trainingId", () => {
      expect(validateNotificationInput({ ...validBaseInput, targetType: "training" })).toBe("Тренінг обов'язковий для цього типу аудиторії");
    });

    it("returns error when user targetType without targetUserIds", () => {
      expect(validateNotificationInput({ ...validBaseInput, targetType: "user" })).toBe("Потрібно вказати хоча б одного отримувача");
      expect(validateNotificationInput({ ...validBaseInput, targetType: "user", targetUserIds: [] })).toBe("Потрібно вказати хоча б одного отримувача");
    });

    it("returns error when scheduledAt is in the past", () => {
      const pastDate = new Date(Date.now() - 3600_000);
      expect(validateNotificationInput({ ...validBaseInput, scheduledAt: pastDate })).toBe("Дата відправки не може бути в минулому");
    });

    it("returns error when expiresAt <= scheduledAt", () => {
      const scheduledAt = new Date(Date.now() + 3600_000);
      const expiresAt = new Date(scheduledAt.getTime() - 1000);
      expect(validateNotificationInput({ ...validBaseInput, scheduledAt, expiresAt })).toBe("Дата закінчення має бути після дати відправки");
    });

    it("returns null when expiresAt is not provided", () => {
      const input: Omit<CreateNotificationInput, "expiresAt"> = {
        title: validBaseInput.title,
        message: validBaseInput.message,
        targetType: validBaseInput.targetType,
        scheduledAt: validBaseInput.scheduledAt,
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      expect(validateNotificationInput(input as any)).toBeNull();
    });
  });
});
