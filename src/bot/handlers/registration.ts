import type { Bot } from "grammy";

import { COURSES, DISCOVERY_SOURCES, INSTITUTIONS, TRAININGS, getTraining } from "../../form.js";
import {
  hasCurrentRulesAcceptance,
  saveRegistration,
} from "../../services/registration.service.js";
import { consentIntro, registrationSummary, trainingLabels } from "../messages.js";
import { sendRules } from "../rules.js";
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
  personalConsentDeclineConfirmationKeyboard,
  registrationActionsKeyboard,
  rulesDeclineConfirmationKeyboard,
  restartRegistrationKeyboard,
  sourceKeyboard,
  trainingKeyboard,
  mainMenuKeyboard,
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
  const rulesAcceptance = ctx.session.rulesAcceptance;
  ctx.session = {
    telegramUsername: ctx.from?.username ?? null,
    registration: { step: "name", isEditing },
    ...(rulesAcceptance ? { rulesAcceptance } : {}),
  };
  await ctx.reply(
    isEditing
      ? "Відредагуємо Вашу анкету. Введіть прізвище та ім’я (без по батькові)."
      : "Вітаю! Заповнимо анкету учасника BTW.\n\nВаше прізвище та ім’я (без по батькові)?",
    { reply_markup: mainMenuKeyboard() },
  );
}

export async function resumeRegistration(
  ctx: BotContext,
  dependencies: BotDependencies,
): Promise<void> {
  const registration = ctx.session.registration;
  if (!registration) {
    await startRegistration(ctx);
    return;
  }

  switch (registration.step) {
    case "name":
      await ctx.reply("Введіть прізвище та ім’я (без по батькові).", {
        reply_markup: REMOVE_KEYBOARD,
      });
      return;
    case "phone":
      await ctx.reply("Вкажіть номер телефону або скористайтеся кнопкою нижче.", {
        reply_markup: phoneKeyboard(),
      });
      return;
    case "institution":
      await ctx.reply("Навчальний заклад, у якому Ви зараз навчаєтеся?", {
        reply_markup: institutionKeyboard(),
      });
      return;
    case "institutionOther":
      await ctx.reply("Напишіть назву навчального закладу.", { reply_markup: backKeyboard() });
      return;
    case "course": {
      const hideMaster = ctx.session.registration?.institution === "ВТФК";
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard(hideMaster) });
      return;
    }
    case "courseOther":
      await ctx.reply("Напишіть Ваш курс.", { reply_markup: backKeyboard() });
      return;
    case "trainings":
      await ctx.reply("На які тренінги Ви плануєте прийти? Натискайте всі потрібні варіанти.", {
        reply_markup: trainingKeyboard(registration.trainingIds),
      });
      return;
    case "source":
      await ctx.reply("Звідки Ви дізналися про BTW?", { reply_markup: sourceKeyboard() });
      return;
    case "sourceOther":
      await ctx.reply("Напишіть, звідки Ви дізналися про захід.", {
        reply_markup: backKeyboard(),
      });
      return;
    case "personalConsent":
      await ctx.reply(consentIntro(dependencies.settings));
      await ctx.reply("Чи надаєте згоду на обробку персональних даних?", {
        reply_markup: consentKeyboard(),
      });
      return;
    case "rulesConsent":
      try {
        await sendRules(ctx, dependencies.rulesService, true);
      } catch {
        await ctx.reply("Не вдалося завантажити правила. Спробуйте ще раз.");
      }
      return;
  }
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
    case "courseOther": {
      setStep(ctx, "course");
      const hideMaster = ctx.session.registration?.institution === "ВТФК";
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard(hideMaster) });
      return;
    }
    case "trainings": {
      setStep(ctx, "course");
      const hideMaster = ctx.session.registration?.institution === "ВТФК";
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard(hideMaster) });
      return;
    }
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

export async function declineConsent(ctx: BotContext, message: string): Promise<void> {
  const wasEditing = ctx.session.registration?.isEditing;
  ctx.session = undefined;
  await ctx.reply(
    wasEditing
      ? `${message} Зміни не збережено, попередня анкета залишилася без змін.`
      : `${message} рані не збережено.`,
    { reply_markup: REMOVE_KEYBOARD },
  );
  await ctx.reply("За бажанням можете спробувати заповнити анкету ще раз.", {
    reply_markup: restartRegistrationKeyboard(),
  });
}

async function showRulesConsent(ctx: BotContext, dependencies: BotDependencies): Promise<void> {
  const pendingAcceptance = ctx.session.rulesAcceptance;
  if (pendingAcceptance?.version === dependencies.settings.eventRulesVersion) {
    const acceptedAt = new Date(pendingAcceptance.acceptedAt);
    if (!Number.isNaN(acceptedAt.getTime())) {
      setStep(ctx, "rulesConsent", {
        rulesAcceptedAt: pendingAcceptance.acceptedAt,
        rulesVersion: pendingAcceptance.version,
      });
      await finishRegistration(ctx, dependencies);
      return;
    }
  }
  delete ctx.session.rulesAcceptance;

  if (ctx.from) {
    const user = await dependencies.users.findByTelegramUserId(ctx.from.id);
    const acceptedAt = user?.eventRulesConsentAt;
    if (
      user &&
      acceptedAt &&
      hasCurrentRulesAcceptance(user, dependencies.settings.eventRulesVersion)
    ) {
      setStep(ctx, "rulesConsent", {
        rulesAcceptedAt: acceptedAt.toISOString(),
        rulesVersion: dependencies.settings.eventRulesVersion,
      });
      await finishRegistration(ctx, dependencies);
      return;
    }
  }

  setStep(ctx, "rulesConsent");
  try {
    await sendRules(ctx, dependencies.rulesService, true);
  } catch {
    await ctx.reply("Не вдалося завантажити правила. Спробуйте /rules і підтвердьте ознайомлення.");
  }
}

export async function finishRegistration(
  ctx: BotContext,
  dependencies: BotDependencies,
  acceptanceJustRecorded = false,
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
    if (
      error instanceof Error &&
      (error.message === "REGISTRATION_INCOMPLETE" ||
        error.message === "REGISTRATION_RULES_NOT_ACCEPTED")
    ) {
      await ctx.reply("Не всі дані анкети заповнені. Натисніть /start і спробуйте ще раз.", {
        reply_markup: REMOVE_KEYBOARD,
      });
      return;
    }
    throw error;
  }

  ctx.session = undefined;
  if (acceptanceJustRecorded) await ctx.reply("✅ Правила прийнято.");
  await ctx.reply(
    registrationSummary({ ...registration, trainingIds }, TRAININGS, ctx.from.username),
    {
      reply_markup: registrationActionsKeyboard(dependencies.settings.chatInviteLink),
    },
  );
  await ctx.reply("Головне меню:", { reply_markup: mainMenuKeyboard(true) });
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
        await ctx.reply("Введіть прізвище та ім’я у форматі «Прізвище Ім’я» - рівно два слова.");
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
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard(text === "ВТФК") });
      return;
    }

    if (hasStep(ctx.session.registration, "institutionOther")) {
      const institution = validateCustomAnswer(text, 150);
      if (!institution) {
        await ctx.reply("Введіть назву навчального закладу (до 150 символів).");
        return;
      }
      setStep(ctx, "course", { institution });
      await ctx.reply("Який Ви курс?", { reply_markup: courseKeyboard(institution === "ВТФК") });
      return;
    }

    if (hasStep(ctx.session.registration, "course")) {
      const isVtfk = ctx.session.registration?.institution === "ВТФК";
      if (text === OTHER) {
        setStep(ctx, "courseOther");
        await ctx.reply("Напишіть Ваш курс.", { reply_markup: backKeyboard() });
        return;
      }
      if (!COURSES.includes(text as (typeof COURSES)[number])) {
        await ctx.reply("Оберіть курс кнопкою нижче.", { reply_markup: courseKeyboard(isVtfk) });
        return;
      }
      if (isVtfk && text === "магістр") {
        await ctx.reply("У ВТФК немає магістратури. Оберіть інший курс.", { reply_markup: courseKeyboard(true) });
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
      if (ctx.session.registration?.institution === "ВТФК" && /маг[іi]ст(р|ер)/i.test(course)) {
        await ctx.reply("У ВТФК немає магістратури. Введіть інший курс.");
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
        await ctx.reply(
          "Ви впевнені, що не погоджуєтеся на обробку персональних даних? Без цієї згоди анкету неможливо завершити.",
          { reply_markup: personalConsentDeclineConfirmationKeyboard() },
        );
        return;
      }
      if (text !== PERSONAL_DATA_YES) {
        await ctx.reply("Будь ласка, оберіть один із варіантів кнопкою нижче.", {
          reply_markup: consentKeyboard(),
        });
        return;
      }
      await showRulesConsent(ctx, dependencies);
      return;
    }

    if (hasStep(ctx.session.registration, "rulesConsent")) {
      if (text === NO_CONSENT) {
        await ctx.reply(
          "Ви впевнені, що не погоджуєтеся з правилами? Без згоди участь у BTW неможлива.",
          { reply_markup: rulesDeclineConfirmationKeyboard() },
        );
        return;
      }
      await ctx.reply("Ознайомтеся з правилами та натисніть inline-кнопку підтвердження.");
    }
  });
}

export function isValidTrainingId(trainingId: string): boolean {
  return getTraining(trainingId)?.active === true;
}

export { toggleTraining };
