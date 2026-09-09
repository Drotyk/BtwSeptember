import type { Bot } from "grammy";

import { TRAININGS } from "../../form.js";
import {
  courseKeyboard,
  registrationActionsKeyboard,
  REMOVE_KEYBOARD,
  rulesDeclineConfirmationKeyboard,
  sourceKeyboard,
  trainingKeyboard,
} from "../keyboards.js";
import { hasStep, toggleTraining, updateState } from "../registration-state.js";
import {
  declineConsent,
  finishRegistration,
  goBack,
  resumeRegistration,
  startRegistration,
} from "./registration.js";
import type { BotDependencies } from "../create-bot.js";
import type { BotContext } from "../types.js";
import { sendRules } from "../rules.js";
import { hasCurrentRulesAcceptance } from "../../services/registration.service.js";
import {
  editSpeakerCarousel,
  showFirstSpeaker,
  showSpeakerDetails,
} from "../../services/telegram-speaker.service.js";

function callbackMessageKey(ctx: BotContext): string {
  const message = ctx.callbackQuery?.message;
  return `${ctx.chat?.id ?? "unknown"}:${message && "message_id" in message ? message.message_id : "inline"}`;
}

async function showRules(ctx: BotContext, dependencies: BotDependencies): Promise<void> {
  try {
    await sendRules(ctx, dependencies.rulesService, false, true);
  } catch {
    await ctx.reply("Не вдалося завантажити правила. Спробуйте пізніше.");
  }
}

export function registerCallbackHandlers(
  bot: Bot<BotContext>,
  dependencies: BotDependencies,
): void {
  const messageQueues = new Map<string, Promise<void>>();

  function enqueueMessageUpdate(key: string, task: () => Promise<void>): Promise<void> {
    const previous = messageQueues.get(key) ?? Promise.resolve();
    const current = previous.catch(() => undefined).then(task);
    messageQueues.set(key, current);
    void current
      .finally(() => {
        if (messageQueues.get(key) === current) messageQueues.delete(key);
      })
      .catch(() => undefined);
    return current;
  }

  bot.on("callback_query:data", async (ctx) => {
    if (ctx.chat?.type !== "private") {
      await ctx.answerCallbackQuery({ text: "Ця дія доступна лише в приватному чаті." });
      return;
    }

    const data = ctx.callbackQuery.data;

    if (data.startsWith("speakers:")) {
      await ctx.answerCallbackQuery();
      try {
        const selection = /^speakers:select:([^:]+)$/.exec(data);
        if (selection?.[1]) {
          await enqueueMessageUpdate(callbackMessageKey(ctx), () =>
            showFirstSpeaker(ctx, dependencies.speakers, selection[1]),
          );
          return;
        }

        const navigation = /^speakers:([^:]+):(prev|next|details|back|noop):(\d+)$/.exec(data);
        if (!navigation?.[1] || !navigation[2] || !navigation[3]) return;
        const trainingId = navigation[1];
        const action = navigation[2];
        const index = Number(navigation[3]);
        if (action === "noop") return;

        await enqueueMessageUpdate(callbackMessageKey(ctx), async () => {
          if (action === "details") {
            await showSpeakerDetails(ctx, dependencies.speakers, trainingId, index);
          } else {
            await editSpeakerCarousel(
              ctx,
              dependencies.speakers,
              trainingId,
              index,
              action as "prev" | "next" | "back",
            );
          }
        });
      } catch (error) {
        const errorName = error instanceof Error ? error.name : "UnknownError";
        console.error("Помилка каруселі спікерів", { errorName });
      }
      return;
    }

    if (data === "registration:edit") {
      await ctx.answerCallbackQuery();
      if (ctx.from && (await dependencies.users.exists(ctx.from.id))) {
        await startRegistration(ctx, true);
      } else {
        await startRegistration(ctx);
      }
      return;
    }

    if (data === "registration:return") {
      await ctx.answerCallbackQuery();
      if (ctx.session.registration) {
        await resumeRegistration(ctx, dependencies);
      } else if (ctx.from && (await dependencies.users.exists(ctx.from.id))) {
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

    if (data === "rules:show" || data === "rules:view") {
      await ctx.answerCallbackQuery();
      await showRules(ctx, dependencies);
      return;
    }

    if (data === "rules:back") {
      if (!hasStep(ctx.session.registration, "rulesConsent")) {
        await ctx.answerCallbackQuery({ text: "Немає активного підтвердження правил." });
        return;
      }
      await ctx.answerCallbackQuery();
      await goBack(ctx);
      return;
    }

    if (data === "rules:decline") {
      if (!hasStep(ctx.session.registration, "rulesConsent")) {
        await ctx.answerCallbackQuery({ text: "Немає активного підтвердження правил." });
        return;
      }
      await ctx.answerCallbackQuery();
      await ctx.reply(
        "Ви впевнені, що не погоджуєтеся з правилами? Без згоди участь у BTW неможлива.",
        { reply_markup: rulesDeclineConfirmationKeyboard() },
      );
      return;
    }

    if (data === "rules:decline:cancel") {
      if (!hasStep(ctx.session.registration, "rulesConsent")) {
        await ctx.answerCallbackQuery({ text: "Немає активного підтвердження правил." });
        return;
      }
      await ctx.answerCallbackQuery();
      try {
        await sendRules(ctx, dependencies.rulesService, true);
      } catch {
        await ctx.reply("Не вдалося завантажити правила. Спробуйте ще раз.");
      }
      return;
    }

    if (data === "rules:decline:confirm") {
      if (!hasStep(ctx.session.registration, "rulesConsent")) {
        await ctx.answerCallbackQuery({ text: "Немає активного підтвердження правил." });
        return;
      }
      await ctx.answerCallbackQuery();
      await declineConsent(ctx, "Без згоди з правилами участь у BTW неможлива.");
      return;
    }

    if (data === "consent:decline:cancel") {
      if (!hasStep(ctx.session.registration, "personalConsent")) {
        await ctx.answerCallbackQuery({ text: "Немає активного підтвердження згоди." });
        return;
      }
      await ctx.answerCallbackQuery();
      await resumeRegistration(ctx, dependencies);
      return;
    }

    if (data === "consent:decline:confirm") {
      if (!hasStep(ctx.session.registration, "personalConsent")) {
        await ctx.answerCallbackQuery({ text: "Немає активного підтвердження згоди." });
        return;
      }
      await ctx.answerCallbackQuery();
      await declineConsent(ctx, "Без згоди анкету неможливо завершити.");
      return;
    }

    if (data === "rules:accept") {
      if (!ctx.from) {
        await ctx.answerCallbackQuery({ text: "Не вдалося визначити користувача." });
        return;
      }

      const registration = ctx.session.registration;
      const acceptedAt = new Date();
      const currentVersion = dependencies.settings.eventRulesVersion;
      if (registration && !hasStep(registration, "rulesConsent")) {
        ctx.session.rulesAcceptance = {
          acceptedAt: acceptedAt.toISOString(),
          version: currentVersion,
        };
        await ctx.answerCallbackQuery();
        await ctx.reply(
          "✅ Правила прийнято. Після заповнення анкети реєстрацію можна буде завершити.",
        );
        return;
      }
      if (registration) {
        ctx.session.registration = updateState(registration, "rulesConsent", {
          rulesAcceptedAt: acceptedAt.toISOString(),
          rulesVersion: currentVersion,
        });
        await ctx.answerCallbackQuery();
        await finishRegistration(ctx, dependencies, true);
        return;
      }

      const user = await dependencies.users.findByTelegramUserId(ctx.from.id);
      if (!user) {
        ctx.session.rulesAcceptance = {
          acceptedAt: acceptedAt.toISOString(),
          version: currentVersion,
        };
        await ctx.answerCallbackQuery();
        await ctx.reply(
          "✅ Правила прийнято. Після /start ця згода буде використана для реєстрації.",
        );
        return;
      }
      if (hasCurrentRulesAcceptance(user, currentVersion)) {
        await ctx.answerCallbackQuery({ text: "Актуальні правила вже прийнято." });
        return;
      }

      const updated = await dependencies.users.acceptRules(ctx.from.id, currentVersion, acceptedAt);
      if (!updated) {
        await ctx.answerCallbackQuery({ text: "Користувача не знайдено." });
        return;
      }
      await ctx.answerCallbackQuery();
      await ctx.reply("✅ Правила прийнято.");
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
