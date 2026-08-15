import { Pool } from "pg";

const CREATE_USERS_TABLE = `
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    telegram_user_id BIGINT NOT NULL UNIQUE,
    phone_number VARCHAR(32) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    age SMALLINT NOT NULL CHECK (age BETWEEN 1 AND 120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users (phone_number);
`;

export function createPool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    min: 1,
    max: 10,
  });
}

export async function initDb(pool: Pool): Promise<void> {
  await pool.query(CREATE_USERS_TABLE);
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
