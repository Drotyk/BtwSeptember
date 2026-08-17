import type { Settings } from "../config.js";
import { getTrainingLabel, type Training } from "../form.js";
import type { RegistrationState } from "./types.js";

export function consentIntro(
  settings: Pick<Settings, "privacyPolicyUrl" | "eventRulesUrl">,
): string {
  return (
    "Перед завершенням анкети ознайомтеся, будь ласка, з документами:\n" +
    `Політика обробки персональних даних: ${settings.privacyPolicyUrl}\n` +
    `Правила BTW: ${settings.eventRulesUrl}\n\n` +
    "Ми збираємо ім’я, номер телефону, Telegram ID/username, навчальний заклад, курс, " +
    "обрані тренінги та джерело інформації, щоб зареєструвати Вас на BTW і зв’язатися щодо заходу."
  );
}

export function privacyMessage(
  settings: Pick<
    Settings,
    "privacyPolicyUrl" | "eventRulesUrl" | "privacyPolicyVersion" | "eventRulesVersion"
  >,
): string {
  return (
    "BTW обробляє дані лише для організації заходу та комунікації з учасниками.\n\n" +
    `Політика обробки персональних даних (версія ${settings.privacyPolicyVersion}): ${settings.privacyPolicyUrl}\n` +
    `Правила BTW (версія ${settings.eventRulesVersion}): ${settings.eventRulesUrl}`
  );
}

export function trainingLabels(trainingIds: string[], trainings: readonly Training[]): string[] {
  return trainingIds
    .map((id) => trainings.find((training) => training.id === id))
    .filter((training): training is Training => training !== undefined)
    .map(getTrainingLabel);
}

export function registrationSummary(
  registration: RegistrationState,
  trainings: readonly Training[],
  telegramUsername?: string,
): string {
  const username = telegramUsername ? `@${telegramUsername.replace(/^@/, "")}` : "не встановлено";
  return [
    registration.isEditing
      ? "Готово! Вашу анкету оновлено."
      : "Готово! Вашу анкету збережено. Дякуємо за реєстрацію на BTW!",
    "",
    `ПІ: ${registration.name}`,
    `Телефон: ${registration.phoneNumber}`,
    `Telegram: ${username}`,
    `Заклад: ${registration.institution}`,
    `Курс: ${registration.course}`,
    "Обрані тренінги:",
    ...trainingLabels(registration.trainingIds ?? [], trainings).map((label) => `• ${label}`),
    `Звідки дізналися: ${registration.discoverySource}`,
  ].join("\n");
}
