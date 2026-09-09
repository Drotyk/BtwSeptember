import type { Bot } from "grammy";

import { TRAININGS, getTrainingLabel } from "../../form.js";
import { privacyMessage } from "../messages.js";
import {
  deleteConfirmationKeyboard,
  EDIT_REGISTRATION_MENU_LABEL,
  JOIN_CHAT_MENU_LABEL,
  joinChatKeyboard,
  mainMenuKeyboard,
  registrationActionsKeyboard,
  REGISTRATION_MENU_LABEL,
  RULES_MENU_LABEL,
} from "../keyboards.js";
import { goBack, resumeRegistration, startRegistration } from "./registration.js";
import type { BotDependencies } from "../create-bot.js";
import { clearSession, type BotContext } from "../types.js";
import type { UserRecord } from "../../repositories/users.repository.js";
import { sendRules } from "../rules.js";
import { showFirstSpeaker, SPEAKERS_MENU_LABEL } from "../../services/telegram-speaker.service.js";

function userDataMessage(user: UserRecord): string {
  return [
    "Ваші дані в BTW:",
    `ПІ: ${user.name}`,
    `Телефон: ${user.phoneNumber}`,
    `Telegram: ${user.telegramUsername ?? "не встановлено"}`,
    `Заклад: ${user.institution ?? "-"}`,
    `Курс: ${user.course ?? "-"}`,
    `Тренінги: ${
      (user.trainingIds ?? [])
        .map((id) => {
          const training = TRAININGS.find((candidate) => candidate.id === id);
          return training ? getTrainingLabel(training) : id;
        })
        .join(", ") || "-"
    }`,
    `Джерело: ${user.discoverySource ?? "-"}`,
  ].join("\n");
}

export function registerCommandHandlers(bot: Bot<BotContext>, dependencies: BotDependencies): void {
  const showRules = async (ctx: BotContext): Promise<void> => {
    try {
      await sendRules(ctx, dependencies.rulesService, false, true);
    } catch {
      await ctx.reply("Не вдалося завантажити правила. Спробуйте пізніше.");
    }
  };

  bot.hears(RULES_MENU_LABEL, async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    await showRules(ctx);
  });

  bot.hears(REGISTRATION_MENU_LABEL, async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) return;
    if (ctx.session.registration) {
      await resumeRegistration(ctx, dependencies);
      return;
    }
    if (await dependencies.users.exists(ctx.from.id)) {
      await startRegistration(ctx, true);
      return;
    }
    await startRegistration(ctx);
  });

  bot.hears(EDIT_REGISTRATION_MENU_LABEL, async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) return;
    if (await dependencies.users.exists(ctx.from.id)) {
      await startRegistration(ctx, true);
      return;
    }
    await ctx.reply("Збереженої анкети не знайдено. Щоб почати реєстрацію, натисніть /start.");
  });

  bot.hears(SPEAKERS_MENU_LABEL, async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    try {
      await showFirstSpeaker(ctx, dependencies.speakers);
    } catch {
      await ctx.reply("Не вдалося завантажити список спікерів. Спробуйте пізніше.");
    }
  });

  bot.hears(JOIN_CHAT_MENU_LABEL, async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    const { chatInviteLink } = dependencies.settings;
    const keyboard = joinChatKeyboard(chatInviteLink);
    if (keyboard) {
      await ctx.reply("Посилання для входу в чат:", { reply_markup: keyboard });
    } else {
      await ctx.reply("Посилання на чат недоступне.");
    }
  });

  bot.command("speakers", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    try {
      await showFirstSpeaker(ctx, dependencies.speakers);
    } catch {
      await ctx.reply("Не вдалося завантажити список спікерів. Спробуйте пізніше.");
    }
  });

  bot.command("start", async (ctx) => {
    if (ctx.chat?.type !== "private" || !ctx.from) return;
    if (await dependencies.users.exists(ctx.from.id)) {
      clearSession(ctx);
      await ctx.reply(
        "Ви вже заповнювали анкету. Повторна реєстрація неможлива, але Ви можете відредагувати свої дані.",
        { reply_markup: registrationActionsKeyboard(dependencies.settings.chatInviteLink) },
      );
      await ctx.reply("Головне меню:", { reply_markup: mainMenuKeyboard(true, dependencies.settings.chatInviteLink) });
      return;
    }
    await startRegistration(ctx);
  });

  bot.command("cancel", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    clearSession(ctx);
    const hasRegistration = Boolean(ctx.from && (await dependencies.users.exists(ctx.from.id)));
    await ctx.reply("Анкету скасовано. Щоб почати знову, натисніть /start.", {
      reply_markup: mainMenuKeyboard(hasRegistration, dependencies.settings.chatInviteLink),
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

  bot.command("rules", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    await showRules(ctx);
  });
}
