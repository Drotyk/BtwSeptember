import type { UserRepository } from "../repositories/users.repository.js";
import type { RegistrationState } from "../bot/types.js";

export interface RegistrationConfig {
  privacyPolicyVersion: string;
  eventRulesVersion: string;
}

export async function saveRegistration(
  repository: UserRepository,
  telegramUserId: number,
  telegramUsername: string | undefined,
  state: RegistrationState,
  trainingLabels: string[],
  config: RegistrationConfig,
): Promise<void> {
  if (
    !state.phoneNumber ||
    !state.name ||
    !state.institution ||
    !state.course ||
    !state.discoverySource ||
    !state.trainingIds?.length
  ) {
    throw new Error("REGISTRATION_INCOMPLETE");
  }

  await repository.save({
    telegramUserId,
    phoneNumber: state.phoneNumber,
    name: state.name,
    telegramUsername: telegramUsername ? `@${telegramUsername.replace(/^@/, "")}` : null,
    institution: state.institution,
    course: state.course,
    trainingIds: state.trainingIds,
    trainings: trainingLabels,
    discoverySource: state.discoverySource,
    consent: {
      personalDataPolicyVersion: config.privacyPolicyVersion,
      eventRulesVersion: config.eventRulesVersion,
    },
  });
}
