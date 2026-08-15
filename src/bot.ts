import { Bot, Context, Keyboard, session, SessionFlavor } from "grammy";
import type { Pool } from "pg";

import { saveUser } from "./db.js";
import { normalizePhone, validateAge, validateName } from "./validators.js";

type RegistrationStep = "phone" | "name" | "age";

interface RegistrationState {
  step: RegistrationStep;
  phoneNumber?: string;
  name?: string;
}

interface SessionData {
  registration?: RegistrationState;
}

type BotContext = Context & SessionFlavor<SessionData>;

const removeKeyboard = { remove_keyboard: true } as const;

function phoneKeyboard(): Keyboard {
  return new Keyboard()
    .requestContact("Надіслати номер телефону")
    .resized()
    .oneTime();
}

function hasStep(ctx: BotContext, step: RegistrationStep): boolean {
  return ctx.session.registration?.step === step;
}

function setPhoneStep(ctx: BotContext, phoneNumber: string): void {
  ctx.session.registration = { step: "name", phoneNumber };
}

export function createBot(token: string, pool: Pool): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  bot.use(session({ initial: (): SessionData => ({}) }));

  bot.command("start", async (ctx) => {
    ctx.session = { registration: { step: "phone" } };
    await ctx.reply(
      "Вітаю! Заповнимо коротку анкету.\n\n" +
        "Натисніть кнопку нижче, щоб надіслати номер телефону, " +
        "або введіть його текстом",
      { reply_markup: phoneKeyboard() },
    );
  });

  bot.command("cancel", async (ctx) => {
    ctx.session = {};
    await ctx.reply("Анкету скасовано. Щоб почати знову, натисніть /start.", {
      reply_markup: removeKeyboard,
    });
  });

  bot.on("message:contact", async (ctx) => {
    if (!hasStep(ctx, "phone")) return;

    const contact = ctx.message.contact;
    if (contact.user_id !== undefined && contact.user_id !== ctx.from.id) {
      await ctx.reply("Будь ласка, надішліть саме свій номер телефону.");
      return;
    }

    const phone = normalizePhone(contact.phone_number);
    if (!phone) {
      await ctx.reply("Не вдалося розпізнати номер. Спробуйте ввести його текстом.");
      return;
    }

    setPhoneStep(ctx, phone);
    await ctx.reply("Дякую! Тепер введіть ваше прізвище та ім’я (ПІ), без по батькові.", {
      reply_markup: removeKeyboard,
    });
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;

    if (hasStep(ctx, "phone")) {
      const phone = normalizePhone(text);
      if (!phone) {
      await ctx.reply(
        "Введіть український номер у форматі +380 50 123 45 67 або 050 123 45 67.",
      );
        return;
      }

      setPhoneStep(ctx, phone);
      await ctx.reply("Дякую! Тепер введіть ваше прізвище та ім’я (ПІ), без по батькові.", {
        reply_markup: removeKeyboard,
      });
      return;
    }

    if (hasStep(ctx, "name")) {
      const name = validateName(text);
      if (!name) {
        await ctx.reply("Введіть ПІ у форматі «Прізвище Ім’я» - рівно два слова, без по батькові.");
        return;
      }

      const registration = ctx.session.registration;
      if (!registration) return;
      ctx.session.registration = { ...registration, step: "age", name };
      await ctx.reply("Скільки вам повних років?");
      return;
    }

    if (hasStep(ctx, "age")) {
      const age = validateAge(text);
      if (!age) {
        await ctx.reply("Вік має бути цілим числом");
        return;
      }

      const registration = ctx.session.registration;
      if (!registration?.phoneNumber || !registration.name) return;

      try {
        await saveUser(pool, ctx.from.id, registration.phoneNumber, registration.name, age);
      } catch (error) {
        console.error("Не вдалося зберегти анкету користувача", error);
        await ctx.reply(
          "Не вдалося зберегти дані через технічну помилку. Спробуйте ще раз через хвилину.",
          { reply_markup: removeKeyboard },
        );
        return;
      }

      ctx.session = {};
      await ctx.reply(
        `Готово! Дані збережено. Дякуємо!\n\nПІ: ${registration.name}\nВік: ${age}`,
        { reply_markup: removeKeyboard },
      );
      return;
    }

    if (ctx.session.registration === undefined) return;
  });

  bot.on("message", async (ctx, next) => {
    const step = ctx.session.registration?.step;
    if (step === "phone") {
      await ctx.reply("Будь ласка, надішліть номер кнопкою або введіть його текстом.");
    } else if (step === "name") {
      await ctx.reply("Будь ласка, введіть ПІ текстом: прізвище та ім’я, без по батькові.");
    } else if (step === "age") {
      await ctx.reply("Будь ласка, введіть вік числом від 1 до 120.");
    } else {
      await next();
    }
  });

  return bot;
}
