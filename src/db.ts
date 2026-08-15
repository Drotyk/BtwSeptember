import { Pool } from "pg";

export function createPool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    min: 1,
    max: 10,
  });
}

export async function saveUser(
  pool: Pool,
  telegramUserId: number,
  phoneNumber: string,
  name: string,
  age: number,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO users (telegram_user_id, phone_number, full_name, age)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (telegram_user_id) DO UPDATE SET
        phone_number = EXCLUDED.phone_number,
        full_name = EXCLUDED.full_name,
        age = EXCLUDED.age,
        updated_at = NOW()
    `,
    [telegramUserId, phoneNumber, name, age],
  );
}
