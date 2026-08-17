import { InlineKeyboard, Keyboard } from "grammy";

import { TRAININGS, getTrainingDate } from "../form.js";

export const REMOVE_KEYBOARD = { remove_keyboard: true } as const;
export const OTHER = "Інше";
export const BACK = "Назад";
export const PERSONAL_DATA_YES = "Так, погоджуюсь";
export const NO_CONSENT = "Не погоджуюсь";

export function backKeyboard(): Keyboard {
  return new Keyboard().text(BACK).resized().oneTime();
}

export function phoneKeyboard(): Keyboard {
  return new Keyboard()
    .requestContact("Надіслати номер телефону")
    .row()
    .text(BACK)
    .resized()
    .oneTime();
}

export function institutionKeyboard(): Keyboard {
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

export function courseKeyboard(): Keyboard {
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

export function sourceKeyboard(): Keyboard {
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

export function consentKeyboard(): Keyboard {
  return new Keyboard()
    .text(PERSONAL_DATA_YES)
    .row()
    .text(NO_CONSENT)
    .row()
    .text(BACK)
    .resized()
    .oneTime();
}

export function trainingKeyboard(selected: string[] = []): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  TRAININGS.filter((training) => training.active).forEach((training) => {
    const marker = selected.includes(training.id) ? "✅ " : "";
    keyboard
      .text(`${marker}${getTrainingDate(training)} — ${training.title}`, `training:${training.id}`)
      .row();
  });
  keyboard.text("Готово", "training:done").row().text(BACK, "training:back");
  return keyboard;
}

export function registrationActionsKeyboard(chatInviteLink: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (chatInviteLink) keyboard.url("Приєднатися до чату", chatInviteLink).row();
  keyboard.text("Редагувати анкету", "registration:edit");
  return keyboard;
}

export function restartRegistrationKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("Почати анкету знову", "registration:restart");
}

export function deleteConfirmationKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("Так, видалити мої дані", "delete:confirm")
    .row()
    .text("Скасувати", "delete:cancel");
}
