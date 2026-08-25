import type { Pool } from "pg";

import {
  createNotificationsRepository,
  type NotificationsRepository,
} from "../repositories/notifications.repository.js";

/** Інтерфейс для Telegram API (sendMessage) */
export interface TelegramSender {
  sendMessage(chatId: number | string, text: string): Promise<void>;
}

const POLL_INTERVAL_MS = 5_000;
const DELIVERY_BATCH_SIZE = 20;
const INTER_MESSAGE_DELAY_MS = 50;
const MAX_DELIVERY_ATTEMPTS = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBotBlockedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const desc =
    "description" in error && typeof error.description === "string" ? error.description : "";
  const code = "error_code" in error && typeof error.error_code === "number" ? error.error_code : 0;
  return (
    code === 403 ||
    desc.includes("bot was blocked") ||
    desc.includes("user is deactivated") ||
    desc.includes("chat not found") ||
    desc.includes("FORBIDDEN")
  );
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "description" in error) {
    return String(error.description);
  }
  return "Невідома помилка";
}

export interface NotificationWorker {
  start(): void;
  stop(): Promise<void>;
}

export function createNotificationWorker(pool: Pool, sender: TelegramSender): NotificationWorker {
  const repo: NotificationsRepository = createNotificationsRepository(pool);
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let stopping = false;

  async function processDelivery(
    deliveryId: number,
    telegramId: string,
    message: string,
    attempts: number,
  ): Promise<void> {
    try {
      await sender.sendMessage(Number(telegramId), message);
      await repo.markDeliveryResult(deliveryId, "sent");
    } catch (error) {
      if (isBotBlockedError(error)) {
        await repo.markDeliveryResult(deliveryId, "blocked", safeErrorMessage(error));
        return;
      }

      const errorMsg = safeErrorMessage(error);
      const isFailed = attempts + 1 >= MAX_DELIVERY_ATTEMPTS;
      await repo.markDeliveryResult(deliveryId, isFailed ? "failed" : "pending", errorMsg);
    }
  }

  async function processNotification(
    notificationId: number,
    message: string,
    targetType: string,
    trainingId: string | null,
    targetUserIds: string[] | null,
  ): Promise<void> {
    // Створити deliveries (ідемпотентно через ON CONFLICT DO NOTHING)
    await repo.createDeliveries(
      notificationId,
      targetType,
      trainingId,
      targetUserIds?.map(Number) ?? null,
    );

    // Обробити deliveries пакетами
    while (!stopping) {
      const batch = await repo.fetchPendingDeliveries(notificationId, DELIVERY_BATCH_SIZE);
      if (batch.length === 0) {
        break;
      }
      for (const delivery of batch) {
        if (stopping) break;
        await processDelivery(Number(delivery.id), delivery.telegramId, message, delivery.attempts);
        await delay(INTER_MESSAGE_DELAY_MS);
      }
    }

    // Фіналізація — визначити підсумковий статус
    await repo.finalizeNotification(notificationId);
  }

  async function tick(): Promise<void> {
    if (running || stopping) return;
    running = true;
    try {
      // 1. Позначити прострочені
      await repo.expireOverdueNotifications();

      // 2. Отримати pending notifications
      const notifications = await repo.fetchPendingNotifications();

      // 3. Обробити кожне
      for (const notification of notifications) {
        if (stopping) break;
        await processNotification(
          Number(notification.id),
          notification.message,
          notification.targetType,
          notification.trainingId,
          notification.targetUserIds,
        );
      }
    } catch (error) {
      // Worker повинен продовжувати працювати незважаючи на помилки
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error("Помилка notification worker", { errorName });
    } finally {
      running = false;
    }
  }

  return {
    start() {
      if (timer) return;
      stopping = false;
      // Перший запуск одразу
      void tick();
      timer = setInterval(() => {
        void tick();
      }, POLL_INTERVAL_MS);
      timer.unref();
      console.info("Notification worker запущений");
    },

    async stop() {
      stopping = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      // Чекаємо завершення поточної обробки
      while (running) {
        await delay(100);
      }
      console.info("Notification worker зупинений");
    },
  };
}
