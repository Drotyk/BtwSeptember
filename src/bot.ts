import { Bot, Context, InlineKeyboard, Keyboard, session, SessionFlavor } from "grammy";
import type { Pool } from "pg";

import { saveUser, userExists } from "./db.js";
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
  isEditing?: boolean;
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
const BACK = "Назад";
const PERSONAL_DATA_YES = "Так, погоджуюсь";
const NO_CONSENT = "Не погоджуюсь";

function backKeyboard(): Keyboard {
  return new Keyboard().text(BACK).resized().oneTime();
}

function phoneKeyboard(): Keyboard {
  return new Keyboard()
    .requestContact("Надіслати номер телефону")
    .row()
    .text(BACK)
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
    .row()
    .text(BACK)
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
    .row()
    .text(BACK)
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
    .row()
    .text(BACK)
    .resized()
    .oneTime();
}

function consentKeyboard(): Keyboard {
  return new Keyboard()
    .text(PERSONAL_DATA_YES)
    .row()
    .text(NO_CONSENT)
    .row()
    .text(BACK)
    .resized()
    .oneTime();
}

function rulesKeyboard(): Keyboard {
  return new Keyboard()
    .text(PERSONAL_DATA_YES)
    .row()
    .text(NO_CONSENT)
    .row()
    .text(BACK)
    .resized()
    .oneTime();
}

function trainingKeyboard(selected: number[] = []): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  TRAININGS.forEach((training, index) => {
    const marker = selected.includes(index) ? "✅ " : "";
    keyboard.text(`${marker}${index + 1}. ${getTrainingDate(training)}`, `training:${index}`).row();
  });

  keyboard.text("Готово", "training:done").row().text(BACK, "training:back");
  return keyboard;
}

function registrationActionsKeyboard(chatInviteLink: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (chatInviteLink) {
    keyboard.url("Приєднатися до чату", chatInviteLink).row();
  }

  keyboard.text("Редагувати анкету", "registration:edit");
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

async function goBack(ctx: BotContext): Promise<void> {
  const step = ctx.session.registration?.step;

  switch (step) {
    case "name":
      await ctx.reply("Це перший крок анкети. Введіть Ваше прізвище та ім’я.", {
        reply_markup: removeKeyboard,
      });
      return;
    case "phone":
      setStep(ctx, "name");
      await ctx.reply("Ваше прізвище та ім’я (без по батькові)?", {
        reply_markup: removeKeyboard,
      });
      return;
    case "username":
      setStep(ctx, "phone");
      await ctx.reply("Вкажіть номер телефону або скористайтеся кнопкою нижче.", {
        reply_markup: phoneKeyboard(),
      });
      return;
    case "institution":
      setStep(ctx, "username");
      await ctx.reply("Введіть Ваш Telegram у форматі @username (наприклад, @ivan_petrenko).", {
        reply_markup: backKeyboard(),
      });
      return;
    case "institutionOther":
      setStep(ctx, "institution");
      await ctx.reply("Навчальний заклад, у якому Ви зараз навчаєтеся?", {
        reply_markup: institutionKeyboard(),
      });
      return;
    case "course":
      setStep(ctx, "institution");
      await ctx.reply("Навчальний заклад, у якому Ви зараз навчаєтеся?", {
        reply_markup: institutionKeyboard(),
      });
      return;
    case "courseOther":
      setStep(ctx, "course");
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard() });
      return;
    case "trainings":
      setStep(ctx, "course");
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard() });
      return;
    case "source":
      setStep(ctx, "trainings");
      await ctx.reply(
        "На які тренінги Ви плануєте прийти?\n\n" +
          "Натискайте на всі потрібні варіанти, а після вибору - «Готово».",
        { reply_markup: trainingKeyboard(ctx.session.registration?.trainings ?? []) },
      );
      return;
    case "sourceOther":
      setStep(ctx, "source");
      await ctx.reply("Звідки Ви дізналися про BEST Training Week?", {
        reply_markup: sourceKeyboard(),
      });
      return;
    case "personalConsent":
      setStep(ctx, "source");
      await ctx.reply("Звідки Ви дізналися про BEST Training Week?", {
        reply_markup: sourceKeyboard(),
      });
      return;
    case "rulesConsent":
      setStep(ctx, "personalConsent");
      await ctx.reply("Чи надаєте згоду BEST Vinnytsia обробляти Ваші персональні дані?", {
        reply_markup: consentKeyboard(),
      });
      return;
    default:
      await ctx.reply("Активної анкети немає. Щоб почати, натисніть /start.");
  }
}

async function finishRegistration(
  ctx: BotContext,
  pool: Pool,
  chatInviteLink: string,
): Promise<void> {
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
  const successMessage = [
    registration.isEditing
      ? "Готово! Вашу анкету оновлено."
      : "Готово! Вашу анкету збережено. Дякуємо за реєстрацію на BTW’26!",
    "",
    `ПІ: ${registration.name}`,
    `Телефон: ${registration.phoneNumber}`,
    `Telegram: ${registration.telegramUsername}`,
    `Заклад: ${registration.institution}`,
    `Курс: ${registration.course}`,
    "Обрані тренінги:",
    ...selectedTrainingDates(registration).map((date) => `• ${date}`),
    `Звідки дізналися: ${registration.discoverySource}`,
  ];

  await ctx.reply(
    successMessage.join("\n"),
    { reply_markup: registrationActionsKeyboard(chatInviteLink) },
  );
}

async function startRegistration(ctx: BotContext, isEditing = false): Promise<void> {
  ctx.session = { registration: { step: "name", isEditing } };
  await ctx.reply(
    isEditing
      ? "Відредагуємо Вашу анкету. Введіть прізвище та ім’я (без по батькові)."
      : "Вітаю! Заповнимо анкету учасника BEST Training Week.\n\n" +
          "Ваше прізвище та ім’я (без по батькові)?",
  );
}

export function createBot(
  token: string,
  pool: Pool,
  chatInviteLink = "",
): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  bot.use(session({ initial: (): SessionData => ({}) }));

  bot.command("start", async (ctx) => {
    if (!ctx.from) return;

    try {
      if (await userExists(pool, ctx.from.id)) {
        ctx.session = {};
        await ctx.reply(
          "Ви вже заповнювали анкету. Повторна реєстрація неможлива, але Ви можете відредагувати свої дані.",
          { reply_markup: registrationActionsKeyboard(chatInviteLink) },
        );
        return;
      }

      await startRegistration(ctx);
    } catch (error) {
      console.error("Не вдалося перевірити реєстрацію користувача", error);
      await ctx.reply("Не вдалося перевірити дані. Спробуйте ще раз через хвилину.", {
        reply_markup: removeKeyboard,
      });
    }
  });

  bot.command("cancel", async (ctx) => {
    ctx.session = {};
    await ctx.reply("Анкету скасовано. Щоб почати знову, натисніть /start.", {
      reply_markup: removeKeyboard,
    });
  });

  bot.command("back", async (ctx) => {
    await goBack(ctx);
  });

  bot.on("callback_query:data", async (ctx) => {
    if (ctx.callbackQuery.data === "registration:edit") {
      await ctx.answerCallbackQuery();
      await startRegistration(ctx, true);
      return;
    }

    if (!hasStep(ctx, "trainings")) {
      await ctx.answerCallbackQuery({ text: "Ця анкета вже завершена або скасована." });
      return;
    }

    const data = ctx.callbackQuery.data;
    const registration = ctx.session.registration;
    if (!registration) return;

    if (data === "training:back") {
      setStep(ctx, "course");
      await ctx.answerCallbackQuery();
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard() });
      return;
    }

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
      reply_markup: backKeyboard(),
    });
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;

    if (text === BACK) {
      await goBack(ctx);
      return;
    }

    if (hasStep(ctx, "name")) {
      const name = validateName(text);
      if (!name) {
        await ctx.reply("Введіть прізвище та ім’я у форматі «Прізвище Ім’я» - рівно два слова.");
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
        reply_markup: backKeyboard(),
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
        await ctx.reply("Напишіть назву навчального закладу.", {
          reply_markup: backKeyboard(),
        });
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
        await ctx.reply("Напишіть Ваш курс.", { reply_markup: backKeyboard() });
        return;
      }

      if (!COURSES.includes(text as (typeof COURSES)[number])) {
        await ctx.reply("Оберіть курс кнопкою нижче.", { reply_markup: courseKeyboard() });
        return;
      }

      setStep(ctx, "trainings", { course: text, trainings: [] });
      await ctx.reply(
        "На які тренінги Ви плануєте прийти?\n\n" +
          "Натискайте на всі потрібні варіанти, а після вибору - «Готово».",
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
          "Натискайте на всі потрібні варіанти, а після вибору - «Готово».",
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
        await ctx.reply("Напишіть, звідки Ви дізналися про захід.", {
          reply_markup: backKeyboard(),
        });
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
      await ctx.reply("Чи ознайомлені та погоджуєтеся з правилами заходу BTW’26?", {
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

      await finishRegistration(ctx, pool, chatInviteLink);
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
