import { Pool } from "pg";

export function createPool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    min: 1,
    max: 10,
  });
}

export async function userExists(pool: Pool, telegramUserId: number): Promise<boolean> {
  const result = await pool.query(
    "SELECT 1 FROM users WHERE telegram_user_id = $1 LIMIT 1",
    [telegramUserId],
  );

  return (result.rowCount ?? 0) > 0;
}

export async function saveUser(
  pool: Pool,
  telegramUserId: number,
  phoneNumber: string,
  name: string,
  telegramUsername: string,
  institution: string,
  course: string,
  trainings: string[],
  discoverySource: string,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO users (
        telegram_user_id,
        phone_number,
        full_name,
        telegram_username,
        institution,
        course,
        trainings,
        discovery_source,
        personal_data_consent,
        event_rules_consent
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, TRUE)
    ON CONFLICT (telegram_user_id) DO UPDATE SET
        phone_number = EXCLUDED.phone_number,
        full_name = EXCLUDED.full_name,
        telegram_username = EXCLUDED.telegram_username,
        institution = EXCLUDED.institution,
        course = EXCLUDED.course,
        trainings = EXCLUDED.trainings,
        discovery_source = EXCLUDED.discovery_source,
        personal_data_consent = EXCLUDED.personal_data_consent,
        event_rules_consent = EXCLUDED.event_rules_consent,
        updated_at = NOW()
    `,
    [
      telegramUserId,
      phoneNumber,
      name,
      telegramUsername,
      institution,
      course,
      trainings,
      discoverySource,
    ],
  );
}
