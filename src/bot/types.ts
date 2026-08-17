import type { Context, SessionFlavor } from "grammy";

export type RegistrationStep =
  | "name"
  | "phone"
  | "institution"
  | "institutionOther"
  | "course"
  | "courseOther"
  | "trainings"
  | "source"
  | "sourceOther"
  | "personalConsent"
  | "rulesConsent";

export interface RegistrationState {
  step: RegistrationStep;
  isEditing?: boolean;
  phoneNumber?: string;
  name?: string;
  institution?: string;
  course?: string;
  trainingIds?: string[];
  discoverySource?: string;
}

export interface SessionData {
  registration?: RegistrationState;
  pendingDeleteConfirmation?: boolean;
}

export type BotContext = Context & SessionFlavor<SessionData>;

export function clearSession(ctx: BotContext): void {
  ctx.session = undefined;
}
