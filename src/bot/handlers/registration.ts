import type { Bot } from "grammy";

import { COURSES, DISCOVERY_SOURCES, INSTITUTIONS, TRAININGS, getTraining } from "../../form.js";
import { saveRegistration } from "../../services/registration.service.js";
import { consentIntro, registrationSummary, trainingLabels } from "../messages.js";
import {
  BACK,
  NO_CONSENT,
  OTHER,
  PERSONAL_DATA_YES,
  REMOVE_KEYBOARD,
  backKeyboard,
  consentKeyboard,
  courseKeyboard,
  institutionKeyboard,
  phoneKeyboard,
  registrationActionsKeyboard,
  restartRegistrationKeyboard,
  sourceKeyboard,
  trainingKeyboard,
} from "../keyboards.js";
import {
  hasStep,
  selectedTrainingIds,
  toggleTraining,
  updateState,
} from "../registration-state.js";
import type { BotContext, RegistrationState, RegistrationStep } from "../types.js";
import type { BotDependencies } from "../create-bot.js";
import { normalizePhone, validateCustomAnswer, validateName } from "../../validators.js";

function setStep(
  ctx: BotContext,
  step: RegistrationStep,
  values: Partial<RegistrationState> = {},
): void {
  ctx.session.registration = updateState(ctx.session.registration, step, values);
}

export async function startRegistration(ctx: BotContext, isEditing = false): Promise<void> {
  ctx.session = { registration: { step: "name", isEditing } };
  await ctx.reply(
    isEditing
      ? "Відредагуємо Вашу анкету. Введіть прізвище та ім’я (без по батькові)."
      : "Вітаю! Заповнимо анкету учасника BTW.\n\nВаше прізвище та ім’я (без по батькові)?",
  );
}

export async function goBack(ctx: BotContext): Promise<void> {
  const step = ctx.session.registration?.step;
  switch (step) {
    case "name":
      await ctx.reply("Це перший крок анкети. Введіть Ваше прізвище та ім’я.", {
        reply_markup: REMOVE_KEYBOARD,
      });
      return;
    case "phone":
      setStep(ctx, "name");
      await ctx.reply("Ваше прізвище та ім’я (без по батькові)?", {
        reply_markup: REMOVE_KEYBOARD,
      });
      return;
    case "institution":
      setStep(ctx, "phone");
      await ctx.reply("Вкажіть номер телефону або скористайтеся кнопкою нижче.", {
        reply_markup: phoneKeyboard(),
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
      await ctx.reply("Оберіть тренінги та натисніть «Готово». ", {
        reply_markup: trainingKeyboard(ctx.session.registration?.trainingIds),
      });
      return;
    case "sourceOther":
      setStep(ctx, "source");
      await ctx.reply("Звідки Ви дізналися про BTW?", { reply_markup: sourceKeyboard() });
      return;
    case "personalConsent":
      setStep(ctx, "source");
      await ctx.reply("Звідки Ви дізналися про BTW?", { reply_markup: sourceKeyboard() });
      return;
    case "rulesConsent":
      setStep(ctx, "personalConsent");
      await ctx.reply("Чи надаєте згоду на обробку персональних даних?", {
        reply_markup: consentKeyboard(),
      });
      return;
    default:
      await ctx.reply("Активної анкети немає. Щоб почати, натисніть /start.");
  }
}

async function declineConsent(ctx: BotContext, message: string): Promise<void> {
  const wasEditing = ctx.session.registration?.isEditing;
  ctx.session = undefined;
  await ctx.reply(
    wasEditing
      ? `${message} Зміни не збережено, попередня анкета залишилася без змін.`
      : `${message} Дані не збережено.`,
    { reply_markup: REMOVE_KEYBOARD },
  );
  await ctx.reply("За бажанням можете спробувати заповнити анкету ще раз.", {
    reply_markup: restartRegistrationKeyboard(),
  });
}

export async function finishRegistration(
  ctx: BotContext,
  dependencies: BotDependencies,
): Promise<void> {
  const registration = ctx.session.registration;
  if (!ctx.from || !registration) {
    await ctx.reply("Не всі дані анкети заповнені. Натисніть /start і спробуйте ще раз.", {
      reply_markup: REMOVE_KEYBOARD,
    });
    ctx.session = undefined;
    return;
  }

  const trainingIds = selectedTrainingIds(registration);
  if (
    !registration.phoneNumber ||
    !registration.name ||
    !registration.institution ||
    !registration.course ||
    !registration.discoverySource ||
    trainingIds.length === 0
  ) {
    await ctx.reply("Не всі дані анкети заповнені. Натисніть /start і спробуйте ще раз.", {
      reply_markup: REMOVE_KEYBOARD,
    });
    ctx.session = undefined;
    return;
  }

  try {
    await saveRegistration(
      dependencies.users,
      ctx.from.id,
      ctx.from.username,
      { ...registration, trainingIds },
      trainingLabels(trainingIds, TRAININGS),
      dependencies.settings,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "REGISTRATION_INCOMPLETE") {
      await ctx.reply("Не всі дані анкети заповнені. Натисніть /start і спробуйте ще раз.", {
        reply_markup: REMOVE_KEYBOARD,
      });
      return;
    }
    throw error;
  }

  ctx.session = undefined;
  await ctx.reply(
    registrationSummary({ ...registration, trainingIds }, TRAININGS, ctx.from.username),
    {
      reply_markup: registrationActionsKeyboard(dependencies.settings.chatInviteLink),
    },
  );
}

export function registerRegistrationHandlers(
  bot: Bot<BotContext>,
  dependencies: BotDependencies,
): void {
  bot.on("message:contact", async (ctx) => {
    if (ctx.chat?.type !== "private" || !hasStep(ctx.session.registration, "phone")) return;
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
    setStep(ctx, "institution", { phoneNumber: phone });
    await ctx.reply("Навчальний заклад, у якому Ви зараз навчаєтеся?", {
      reply_markup: institutionKeyboard(),
    });
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.chat?.type !== "private") return;
    const text = ctx.message.text;
    if (text === BACK) {
      await goBack(ctx);
      return;
    }

    if (hasStep(ctx.session.registration, "name")) {
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

    if (hasStep(ctx.session.registration, "phone")) {
      const phone = normalizePhone(text);
      if (!phone) {
        await ctx.reply("Введіть український номер у форматі +380 50 123 45 67 або 050 123 45 67.");
        return;
      }
      setStep(ctx, "institution", { phoneNumber: phone });
      await ctx.reply("Навчальний заклад, у якому Ви зараз навчаєтеся?", {
        reply_markup: institutionKeyboard(),
      });
      return;
    }

    if (hasStep(ctx.session.registration, "institution")) {
      if (text === OTHER) {
        setStep(ctx, "institutionOther");
        await ctx.reply("Напишіть назву навчального закладу.", { reply_markup: backKeyboard() });
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

    if (hasStep(ctx.session.registration, "institutionOther")) {
      const institution = validateCustomAnswer(text, 150);
      if (!institution) {
        await ctx.reply("Введіть назву навчального закладу (до 150 символів).");
        return;
      }
      setStep(ctx, "course", { institution });
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard() });
      return;
    }

    if (hasStep(ctx.session.registration, "course")) {
      if (text === OTHER) {
        setStep(ctx, "courseOther");
        await ctx.reply("Напишіть Ваш курс.", { reply_markup: backKeyboard() });
        return;
      }
      if (!COURSES.includes(text as (typeof COURSES)[number])) {
        await ctx.reply("Оберіть курс кнопкою нижче.", { reply_markup: courseKeyboard() });
        return;
      }
      setStep(ctx, "trainings", { course: text, trainingIds: [] });
      await ctx.reply("На які тренінги Ви плануєте прийти? Натискайте всі потрібні варіанти.", {
        reply_markup: trainingKeyboard(),
      });
      return;
    }

    if (hasStep(ctx.session.registration, "courseOther")) {
      const course = validateCustomAnswer(text, 50);
      if (!course) {
        await ctx.reply("Введіть Ваш курс (до 50 символів).");
        return;
      }
      setStep(ctx, "trainings", { course, trainingIds: [] });
      await ctx.reply("На які тренінги Ви плануєте прийти? Натискайте всі потрібні варіанти.", {
        reply_markup: trainingKeyboard(),
      });
      return;
    }

    if (hasStep(ctx.session.registration, "trainings")) {
      await ctx.reply("Оберіть тренінги кнопками та натисніть «Готово».");
      return;
    }

    if (hasStep(ctx.session.registration, "source")) {
      if (text === OTHER) {
        setStep(ctx, "sourceOther");
        await ctx.reply("Напишіть, звідки Ви дізналися про захід.", {
          reply_markup: backKeyboard(),
        });
        return;
      }
      if (!DISCOVERY_SOURCES.includes(text as (typeof DISCOVERY_SOURCES)[number])) {
        await ctx.reply("Оберіть один із варіантів кнопкою нижче.", {
          reply_markup: sourceKeyboard(),
        });
        return;
      }
      setStep(ctx, "personalConsent", { discoverySource: text });
      await ctx.reply(consentIntro(dependencies.settings));
      await ctx.reply("Чи надаєте згоду на обробку персональних даних?", {
        reply_markup: consentKeyboard(),
      });
      return;
    }

    if (hasStep(ctx.session.registration, "sourceOther")) {
      const discoverySource = validateCustomAnswer(text, 150);
      if (!discoverySource) {
        await ctx.reply("Введіть відповідь (до 150 символів).");
        return;
      }
      setStep(ctx, "personalConsent", { discoverySource });
      await ctx.reply(consentIntro(dependencies.settings));
      await ctx.reply("Чи надаєте згоду на обробку персональних даних?", {
        reply_markup: consentKeyboard(),
      });
      return;
    }

    if (hasStep(ctx.session.registration, "personalConsent")) {
      if (text === NO_CONSENT) {
        await declineConsent(ctx, "Без згоди анкету неможливо завершити.");
        return;
      }
      if (text !== PERSONAL_DATA_YES) {
        await ctx.reply("Будь ласка, оберіть один із варіантів кнопкою нижче.", {
          reply_markup: consentKeyboard(),
        });
        return;
      }
      setStep(ctx, "rulesConsent");
      await ctx.reply("Чи ознайомлені та погоджуєтеся з правилами BTW?", {
        reply_markup: consentKeyboard(),
      });
      return;
    }

    if (hasStep(ctx.session.registration, "rulesConsent")) {
      if (text === NO_CONSENT) {
        await declineConsent(ctx, "Без згоди з правилами участь у BTW неможлива.");
        return;
      }
      if (text !== PERSONAL_DATA_YES) {
        await ctx.reply("Будь ласка, оберіть один із варіантів кнопкою нижче.", {
          reply_markup: consentKeyboard(),
        });
        return;
      }
      await finishRegistration(ctx, dependencies);
    }
  });
}

export function isValidTrainingId(trainingId: string): boolean {
  return getTraining(trainingId)?.active === true;
}

export { toggleTraining };
