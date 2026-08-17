import type { Bot } from "grammy";

import { TRAININGS } from "../../form.js";
import {
  courseKeyboard,
  registrationActionsKeyboard,
  REMOVE_KEYBOARD,
  sourceKeyboard,
  trainingKeyboard,
} from "../keyboards.js";
import { hasStep, toggleTraining, updateState } from "../registration-state.js";
import { startRegistration } from "./registration.js";
import type { BotDependencies } from "../create-bot.js";
import type { BotContext } from "../types.js";

export function registerCallbackHandlers(
  bot: Bot<BotContext>,
  dependencies: BotDependencies,
): void {
  bot.on("callback_query:data", async (ctx) => {
    if (ctx.chat?.type !== "private") {
      await ctx.answerCallbackQuery({ text: "Ця дія доступна лише в приватному чаті." });
      return;
    }

    const data = ctx.callbackQuery.data;
    if (data === "registration:edit") {
      await ctx.answerCallbackQuery();
      if (ctx.from && (await dependencies.users.exists(ctx.from.id))) {
        await startRegistration(ctx, true);
      } else {
        await startRegistration(ctx);
      }
      return;
    }

    if (data === "registration:restart") {
      await ctx.answerCallbackQuery();
      if (ctx.from && (await dependencies.users.exists(ctx.from.id))) {
        ctx.session = undefined;
        await ctx.reply("Ви вже заповнювали анкету. Для зміни даних скористайтеся редагуванням.", {
          reply_markup: registrationActionsKeyboard(dependencies.settings.chatInviteLink),
        });
      } else {
        await startRegistration(ctx);
      }
      return;
    }

    if (data === "delete:cancel") {
      ctx.session.pendingDeleteConfirmation = false;
      await ctx.answerCallbackQuery();
      await ctx.reply("Видалення скасовано.");
      return;
    }

    if (data === "delete:confirm") {
      if (!ctx.session.pendingDeleteConfirmation || !ctx.from) {
        await ctx.answerCallbackQuery({ text: "Підтвердження вже неактивне." });
        return;
      }
      await dependencies.users.deleteByTelegramUserId(ctx.from.id);
      ctx.session = undefined;
      await ctx.answerCallbackQuery();
      await ctx.reply("Вашу анкету та пов’язані персональні дані видалено.", {
        reply_markup: REMOVE_KEYBOARD,
      });
      return;
    }

    if (!hasStep(ctx.session.registration, "trainings")) {
      await ctx.answerCallbackQuery({ text: "Ця анкета вже завершена або скасована." });
      return;
    }

    const registration = ctx.session.registration;
    if (!registration) return;

    if (data === "training:back") {
      ctx.session.registration = updateState(registration, "course");
      await ctx.answerCallbackQuery();
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard() });
      return;
    }

    if (data === "training:done") {
      if (!registration.trainingIds?.length) {
        await ctx.answerCallbackQuery({ text: "Оберіть хоча б один тренінг", show_alert: true });
        return;
      }
      ctx.session.registration = updateState(registration, "source");
      await ctx.answerCallbackQuery();
      await ctx.reply("Звідки Ви дізналися про BTW?", { reply_markup: sourceKeyboard() });
      return;
    }

    const match = /^training:(.+)$/.exec(data);
    const trainingId = match?.[1];
    if (
      !trainingId ||
      !TRAININGS.some((training) => training.id === trainingId && training.active)
    ) {
      await ctx.answerCallbackQuery({ text: "Невідомий тренінг" });
      return;
    }

    ctx.session.registration = toggleTraining(registration, trainingId);
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({
      reply_markup: trainingKeyboard(ctx.session.registration.trainingIds),
    });
  });
}
