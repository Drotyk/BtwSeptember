import type { Bot } from "grammy";

import { TRAININGS, getTrainingLabel } from "../../form.js";
import { privacyMessage } from "../messages.js";
import {
  deleteConfirmationKeyboard,
  registrationActionsKeyboard,
  REMOVE_KEYBOARD,
} from "../keyboards.js";
import { goBack, startRegistration } from "./registration.js";
import type { BotDependencies } from "../create-bot.js";
import { clearSession, type BotContext } from "../types.js";
import type { UserRecord } from "../../repositories/users.repository.js";

function userDataMessage(user: UserRecord): string {
  return [
    "Ваші дані в BTW:",
    `ПІ: ${user.name}`,
    `Телефон: ${user.phoneNumber}`,
    `Telegram: ${user.telegramUsername ?? "не встановлено"}`,
    `Заклад: ${user.institution ?? "—"}`,
    `Курс: ${user.course ?? "—"}`,
    `Тренінги: ${
      (user.trainingIds ?? [])
        .map((id) => {
          const training = TRAININGS.find((candidate) => candidate.id === id);
          return training ? getTrainingLabel(training) : id;
        })
        .join(", ") || "—"
    }`,
    `Джерело: ${user.discoverySource ?? "—"}`,
  ].join("\n");
}

export function registerCommandHandlers(bot: Bot<BotContext>, dependencies: BotDependencies): void {
  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) return;
    if (await dependencies.users.exists(ctx.from.id)) {
      clearSession(ctx);
      await ctx.reply(
        "Ви вже заповнювали анкету. Повторна реєстрація неможлива, але Ви можете відредагувати свої дані.",
        { reply_markup: registrationActionsKeyboard(dependencies.settings.chatInviteLink) },
      );
      return;
    }
    await startRegistration(ctx);
  });

  bot.command("cancel", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    clearSession(ctx);
    await ctx.reply("Анкету скасовано. Щоб почати знову, натисніть /start.", {
      reply_markup: REMOVE_KEYBOARD,
    });
  });

  bot.command("back", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    await goBack(ctx);
  });

  bot.command("privacy", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    await ctx.reply(privacyMessage(dependencies.settings));
  });

  bot.command("mydata", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) return;
    const user = await dependencies.users.findByTelegramUserId(ctx.from.id);
    await ctx.reply(user ? userDataMessage(user) : "Збереженої анкети не знайдено.");
  });

  bot.command("delete_me", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    ctx.session.pendingDeleteConfirmation = true;
    await ctx.reply(
      "Ви дійсно хочете видалити анкету та всі пов’язані персональні дані? Цю дію не можна скасувати.",
      { reply_markup: deleteConfirmationKeyboard() },
    );
  });
}
