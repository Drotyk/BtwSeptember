import { Pool } from "pg";

import { createUsersRepository } from "./repositories/users.repository.js";

export function createPool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    min: 1,
    max: 10,
  });
}

export async function userExists(pool: Pool, telegramUserId: number): Promise<boolean> {
  return createUsersRepository(pool).exists(telegramUserId);
}

export async function saveUser(
  pool: Pool,
  telegramUserId: number,
  phoneNumber: string,
  name: string,
  telegramUsername: string | null,
  institution: string,
  course: string,
  trainings: string[],
  discoverySource: string,
  privacyPolicyVersion = "legacy",
  eventRulesVersion = "legacy",
): Promise<void> {
  await createUsersRepository(pool).save({
    telegramUserId,
    phoneNumber,
    name,
    telegramUsername,
    institution,
    course,
    trainingIds: trainings,
    trainings,
    discoverySource,
    consent: {
      personalDataPolicyVersion: privacyPolicyVersion,
      eventRulesVersion,
    },
  });
}
