import { Bot, Context, InlineKeyboard, Keyboard, session, SessionFlavor } from "grammy";
import type { Pool } from "pg";

import { saveUser } from "./db.js";
import { COURSES, DISCOVERY_SOURCES, getTrainingDate, INSTITUTIONS, TRAININGS } from "./form.js";
import { normalizePhone, normalizeTelegramUsername, validateCustomAnswer, validateName } from "./validators.js";

type RegistrationStep =
  | "name"
  | "phone"
  | "username"
  | "institution"
  | "institutionOther"
  | "course"
  | "courseOther"
  | "trainings"
  | "source"
  | "sourceOther"
  | "personalConsent"
  | "rulesConsent";

interface RegistrationState {
  step: RegistrationStep;
  phoneNumber?: string;
  name?: string;
  telegramUsername?: string;
  institution?: string;
  course?: string;
  trainings?: number[];
  discoverySource?: string;
}

interface SessionData {
  registration?: RegistrationState;
}

type BotContext = Context & SessionFlavor<SessionData>;

const removeKeyboard = { remove_keyboard: true } as const;
const OTHER = "Інше";
const PERSONAL_DATA_YES = "Так, погоджуюсь";
const NO_CONSENT = "Не погоджуюсь";

function phoneKeyboard(): Keyboard {
  return new Keyboard()
    .requestContact("Надіслати номер телефону")
    .resized()
    .oneTime();
}

function institutionKeyboard(): Keyboard {
  return new Keyboard()
    .text("ВНТУ")
    .text("ВНМУ")
    .row()
    .text("ВНАУ")
    .text("ВДПУ")
    .row()
    .text("ДонНУ")
    .text(OTHER)
    .resized()
    .oneTime();
}

function courseKeyboard(): Keyboard {
  return new Keyboard()
    .text("1")
    .text("2")
    .text("3")
    .row()
    .text("4")
    .text("магістр")
    .text(OTHER)
    .resized()
    .oneTime();
}

function sourceKeyboard(): Keyboard {
  return new Keyboard()
    .text("Живі оголошення")
    .row()
    .text("Від знайомих")
    .row()
    .text("Із соціальних мереж")
    .row()
    .text(OTHER)
    .resized()
    .oneTime();
}

function consentKeyboard(): Keyboard {
  return new Keyboard().text(PERSONAL_DATA_YES).row().text(NO_CONSENT).resized().oneTime();
}

function rulesKeyboard(): Keyboard {
  return new Keyboard().text(PERSONAL_DATA_YES).row().text(NO_CONSENT).resized().oneTime();
}

function trainingKeyboard(selected: number[] = []): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  TRAININGS.forEach((training, index) => {
    const marker = selected.includes(index) ? "✅ " : "";
    keyboard.text(`${marker}${index + 1}. ${getTrainingDate(training)}`, `training:${index}`).row();
  });

  keyboard.text("Готово", "training:done");
  return keyboard;
}

function hasStep(ctx: BotContext, step: RegistrationStep): boolean {
  return ctx.session.registration?.step === step;
}

function setStep(
  ctx: BotContext,
  step: RegistrationStep,
  values: Partial<RegistrationState> = {},
): void {
  ctx.session.registration = {
    ...ctx.session.registration,
    ...values,
    step,
  };
}

function selectedTrainings(registration: RegistrationState): string[] {
  return (registration.trainings ?? []).map((index) => TRAININGS[index]).filter(Boolean);
}

function selectedTrainingDates(registration: RegistrationState): string[] {
  return selectedTrainings(registration).map(getTrainingDate);
}

async function finishRegistration(ctx: BotContext, pool: Pool): Promise<void> {
  const registration = ctx.session.registration;
  if (
    !ctx.from ||
    !registration?.phoneNumber ||
    !registration.name ||
    !registration.telegramUsername ||
    !registration.institution ||
    !registration.course ||
    !registration.discoverySource ||
    !registration.trainings?.length
  ) {
    await ctx.reply("Не всі дані анкети заповнені. Натисніть /start і спробуйте ще раз.", {
      reply_markup: removeKeyboard,
    });
    ctx.session = {};
    return;
  }

  try {
    await saveUser(
      pool,
      ctx.from.id,
      registration.phoneNumber,
      registration.name,
      registration.telegramUsername,
      registration.institution,
      registration.course,
      selectedTrainings(registration),
      registration.discoverySource,
    );
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
    [
      "Готово! Вашу анкету збережено. Дякуємо за реєстрацію на BTW’25!",
      "",
      `ПІ: ${registration.name}`,
      `Телефон: ${registration.phoneNumber}`,
      `Telegram: ${registration.telegramUsername}`,
      `Заклад: ${registration.institution}`,
      `Курс: ${registration.course}`,
      "Обрані тренінги:",
      ...selectedTrainingDates(registration).map((date) => `• ${date}`),
      `Звідки дізналися: ${registration.discoverySource}`,
    ].join("\n"),
    { reply_markup: removeKeyboard },
  );
}

export function createBot(token: string, pool: Pool): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  bot.use(session({ initial: (): SessionData => ({}) }));

  bot.command("start", async (ctx) => {
    ctx.session = { registration: { step: "name" } };
    await ctx.reply(
      "Вітаю! Заповнимо анкету учасника BEST Training Week.\n\n" +
        "Ваше прізвище та ім’я (без по батькові)?",
    );
  });

  bot.command("cancel", async (ctx) => {
    ctx.session = {};
    await ctx.reply("Анкету скасовано. Щоб почати знову, натисніть /start.", {
      reply_markup: removeKeyboard,
    });
  });

  bot.on("callback_query:data", async (ctx) => {
    if (!hasStep(ctx, "trainings")) {
      await ctx.answerCallbackQuery({ text: "Ця анкета вже завершена або скасована." });
      return;
    }

    const data = ctx.callbackQuery.data;
    const registration = ctx.session.registration;
    if (!registration) return;

    if (data === "training:done") {
      if (!registration.trainings?.length) {
        await ctx.answerCallbackQuery({
          text: "Оберіть хоча б один тренінг",
          show_alert: true,
        });
        return;
      }

      setStep(ctx, "source");
      await ctx.answerCallbackQuery();
      await ctx.reply("Звідки Ви дізналися про BEST Training Week?", {
        reply_markup: sourceKeyboard(),
      });
      return;
    }

    const match = /^training:(\d+)$/.exec(data);
    if (!match) {
      await ctx.answerCallbackQuery();
      return;
    }

    const index = Number(match[1]);
    if (!Number.isInteger(index) || index < 0 || index >= TRAININGS.length) {
      await ctx.answerCallbackQuery({ text: "Невідомий тренінг" });
      return;
    }

    const selected = new Set(registration.trainings ?? []);
    if (selected.has(index)) selected.delete(index);
    else selected.add(index);

    const trainings = [...selected].sort((left, right) => left - right);
    ctx.session.registration = { ...registration, trainings };
    await ctx.answerCallbackQuery();
    await ctx.editMessageReplyMarkup({ reply_markup: trainingKeyboard(trainings) });
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

    setStep(ctx, "username", { phoneNumber: phone });
    await ctx.reply("Введіть Ваш Telegram у форматі @username (наприклад, @ivan_petrenko).", {
      reply_markup: removeKeyboard,
    });
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;

    if (hasStep(ctx, "name")) {
      const name = validateName(text);
      if (!name) {
        await ctx.reply("Введіть прізвище та ім’я у форматі «Прізвище Ім’я» — рівно два слова.");
        return;
      }

      setStep(ctx, "phone", { name });
      await ctx.reply("Вкажіть номер телефону або скористайтеся кнопкою нижче.", {
        reply_markup: phoneKeyboard(),
      });
      return;
    }

    if (hasStep(ctx, "phone")) {
      const phone = normalizePhone(text);
      if (!phone) {
        await ctx.reply("Введіть український номер у форматі +380 50 123 45 67 або 050 123 45 67.");
        return;
      }

      setStep(ctx, "username", { phoneNumber: phone });
      await ctx.reply("Введіть Ваш Telegram у форматі @username (наприклад, @ivan_petrenko).", {
        reply_markup: removeKeyboard,
      });
      return;
    }

    if (hasStep(ctx, "username")) {
      const telegramUsername = normalizeTelegramUsername(text);
      if (!telegramUsername) {
        await ctx.reply("Введіть коректний Telegram username у форматі @username (5–32 символи).");
        return;
      }

      setStep(ctx, "institution", { telegramUsername });
      await ctx.reply("Навчальний заклад, у якому Ви зараз навчаєтеся?", {
        reply_markup: institutionKeyboard(),
      });
      return;
    }

    if (hasStep(ctx, "institution")) {
      if (text === OTHER) {
        setStep(ctx, "institutionOther");
        await ctx.reply("Напишіть назву навчального закладу.", { reply_markup: removeKeyboard });
        return;
      }

      if (!INSTITUTIONS.includes(text as (typeof INSTITUTIONS)[number])) {
        await ctx.reply("Оберіть навчальний заклад кнопкою нижче.", {
          reply_markup: institutionKeyboard(),
        });
        return;
      }

      setStep(ctx, "course", { institution: text });
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard() });
      return;
    }

    if (hasStep(ctx, "institutionOther")) {
      const institution = validateCustomAnswer(text, 150);
      if (!institution) {
        await ctx.reply("Введіть назву навчального закладу (до 150 символів).");
        return;
      }

      setStep(ctx, "course", { institution });
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard() });
      return;
    }

    if (hasStep(ctx, "course")) {
      if (text === OTHER) {
        setStep(ctx, "courseOther");
        await ctx.reply("Напишіть Ваш курс.", { reply_markup: removeKeyboard });
        return;
      }

      if (!COURSES.includes(text as (typeof COURSES)[number])) {
        await ctx.reply("Оберіть курс кнопкою нижче.", { reply_markup: courseKeyboard() });
        return;
      }

      setStep(ctx, "trainings", { course: text, trainings: [] });
      await ctx.reply(
        "На які тренінги Ви плануєте прийти?\n\n" +
          "Натискайте на всі потрібні варіанти, а після вибору — «Готово».",
        { reply_markup: trainingKeyboard() },
      );
      return;
    }

    if (hasStep(ctx, "courseOther")) {
      const course = validateCustomAnswer(text, 50);
      if (!course) {
        await ctx.reply("Введіть Ваш курс (до 50 символів).");
        return;
      }

      setStep(ctx, "trainings", { course, trainings: [] });
      await ctx.reply(
        "На які тренінги Ви плануєте прийти?\n\n" +
          "Натискайте на всі потрібні варіанти, а після вибору — «Готово».",
        { reply_markup: trainingKeyboard() },
      );
      return;
    }

    if (hasStep(ctx, "trainings")) {
      await ctx.reply("Оберіть тренінги кнопками під попереднім повідомленням і натисніть «Готово».");
      return;
    }

    if (hasStep(ctx, "source")) {
      if (text === OTHER) {
        setStep(ctx, "sourceOther");
        await ctx.reply("Напишіть, звідки Ви дізналися про захід.", { reply_markup: removeKeyboard });
        return;
      }

      if (!DISCOVERY_SOURCES.includes(text as (typeof DISCOVERY_SOURCES)[number])) {
        await ctx.reply("Оберіть один із варіантів кнопкою нижче.", { reply_markup: sourceKeyboard() });
        return;
      }

      setStep(ctx, "personalConsent", { discoverySource: text });
      await ctx.reply(
        "Чи надаєте згоду BEST Vinnytsia обробляти Ваші персональні дані?",
        { reply_markup: consentKeyboard() },
      );
      return;
    }

    if (hasStep(ctx, "sourceOther")) {
      const discoverySource = validateCustomAnswer(text, 150);
      if (!discoverySource) {
        await ctx.reply("Введіть відповідь (до 150 символів).");
        return;
      }

      setStep(ctx, "personalConsent", { discoverySource });
      await ctx.reply(
        "Чи надаєте згоду BEST Vinnytsia обробляти Ваші персональні дані?",
        { reply_markup: consentKeyboard() },
      );
      return;
    }

    if (hasStep(ctx, "personalConsent")) {
      if (text === NO_CONSENT) {
        ctx.session = {};
        await ctx.reply("Без згоди анкету неможливо завершити. Дані не збережено.", {
          reply_markup: removeKeyboard,
        });
        return;
      }

      if (text !== PERSONAL_DATA_YES) {
        await ctx.reply("Будь ласка, оберіть один із варіантів кнопкою нижче.", {
          reply_markup: consentKeyboard(),
        });
        return;
      }

      setStep(ctx, "rulesConsent");
      await ctx.reply("Чи ознайомлені та погоджуєтеся з правилами заходу BTW’25?", {
        reply_markup: rulesKeyboard(),
      });
      return;
    }

    if (hasStep(ctx, "rulesConsent")) {
      if (text === NO_CONSENT) {
        ctx.session = {};
        await ctx.reply("Без згоди з правилами захід неможливий. Дані не збережено.", {
          reply_markup: removeKeyboard,
        });
        return;
      }

      if (text !== PERSONAL_DATA_YES) {
        await ctx.reply("Будь ласка, оберіть один із варіантів кнопкою нижче.", {
          reply_markup: rulesKeyboard(),
        });
        return;
      }

      await finishRegistration(ctx, pool);
    }
  });

  bot.on("message", async (ctx, next) => {
    const step = ctx.session.registration?.step;
    if (step === "name") {
      await ctx.reply("Будь ласка, введіть прізвище та ім’я текстом.");
    } else if (step === "phone") {
      await ctx.reply("Будь ласка, надішліть номер кнопкою або введіть його текстом.");
    } else if (step === "trainings") {
      await ctx.reply("Оберіть тренінги кнопками під попереднім повідомленням.");
    } else if (step) {
      await ctx.reply("Будь ласка, надішліть відповідь текстом або скористайтеся кнопкою.");
    } else {
      await next();
    }
  });

  return bot;
}
