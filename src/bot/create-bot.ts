import { randomUUID } from "node:crypto";

import { Bot, session } from "grammy";
import type { Pool } from "pg";

import type { Settings } from "../config.js";
import { createSessionStorage, privateSessionKey } from "../repositories/sessions.repository.js";
import { createUsersRepository, type UserRepository } from "../repositories/users.repository.js";
import { registerCallbackHandlers } from "./handlers/callbacks.js";
import { registerCommandHandlers } from "./handlers/commands.js";
import { registerRegistrationHandlers } from "./handlers/registration.js";
import type { BotContext } from "./types.js";

export interface BotDependencies {
  users: UserRepository;
  settings: Pick<
    Settings,
    | "chatInviteLink"
    | "privacyPolicyUrl"
    | "eventRulesUrl"
    | "privacyPolicyVersion"
    | "eventRulesVersion"
  >;
}

export function createBot(settings: Settings, pool: Pool): Bot<BotContext> {
  const bot = new Bot<BotContext>(settings.botToken);
  const dependencies: BotDependencies = {
    users: createUsersRepository(pool),
    settings,
  };

  bot.use(
    session({
      initial: () => ({}),
      getSessionKey: privateSessionKey,
      storage: createSessionStorage(pool, settings.sessionTtlMs),
    }),
  );
  registerCommandHandlers(bot, dependencies);
  registerCallbackHandlers(bot, dependencies);
  registerRegistrationHandlers(bot, dependencies);

  bot.on("message", async (ctx, next) => {
    if (ctx.chat?.type !== "private") {
      await next();
      return;
    }
    const step = ctx.session.registration?.step;
    if (step === "name") await ctx.reply("Будь ласка, введіть прізвище та ім’я текстом.");
    else if (step === "phone")
      await ctx.reply("Будь ласка, надішліть номер кнопкою або введіть його текстом.");
    else if (step === "trainings")
      await ctx.reply("Оберіть тренінги кнопками та натисніть «Готово».");
    else if (step)
      await ctx.reply("Будь ласка, надішліть відповідь текстом або скористайтеся кнопкою.");
    else await next();
  });

  bot.catch(async (botError) => {
    const errorId = randomUUID();
    const errorName = botError.error instanceof Error ? botError.error.name : "UnknownError";
    console.error("Помилка обробки Telegram update", { errorId, errorName });
    try {
      await botError.ctx.reply(
        `Не вдалося обробити запит. Спробуйте ще раз пізніше. Код: ${errorId}`,
      );
    } catch {
      // Telegram may be unavailable too; the original error is already correlated in logs.
    }
  });

  return bot;
}
