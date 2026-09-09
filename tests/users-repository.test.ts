import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import { createUsersRepository } from "../src/repositories/users.repository.js";
import { createStatisticsRepository } from "../src/repositories/statistics.repository.js";

describe("users repository rules acceptance", () => {
  it("updates acceptance using the Telegram user id and trusted version", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
    const repository = createUsersRepository({ query } as unknown as Pool);
    const acceptedAt = new Date("2026-09-01T15:30:00.000Z");

    await expect(repository.acceptRules(42, "1.1", acceptedAt)).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(expect.stringContaining("WHERE telegram_user_id = $1"), [
      42,
      acceptedAt,
      "1.1",
    ]);
  });

  it("reports a missing user without claiming acceptance", async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const repository = createUsersRepository({ query } as unknown as Pool);

    await expect(repository.acceptRules(404, "1.1", new Date())).resolves.toBe(false);
  });
});

describe("statistics repository", () => {
  it("aggregates registration data without loading individual users", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('"totalUsers"')) {
        return {
          rows: [{ totalUsers: "3", usersWithTraining: "2", totalTrainingSelections: "4" }],
          rowCount: 1,
        };
      }
      if (sql.includes("selected_training")) {
        return {
          rows: [
            { id: "leadership", count: 2 },
            { id: "acting", count: 1 },
          ],
          rowCount: 2,
        };
      }
      if (sql.includes("discovery_source")) {
        return { rows: [{ label: "Від знайомих", count: 2 }], rowCount: 1 };
      }
      if (sql.includes("institution")) {
        return { rows: [{ label: "ВНТУ", count: 3 }], rowCount: 1 };
      }
      return { rows: [{ label: "2", count: 2 }], rowCount: 1 };
    });
    const repository = createStatisticsRepository({ query } as unknown as Pool);

    await expect(repository.getUsersStatistics()).resolves.toEqual({
      totalUsers: 3,
      usersWithTraining: 2,
      totalTrainingSelections: 4,
      trainingSelections: [
        { id: "leadership", count: 2 },
        { id: "acting", count: 1 },
      ],
      discoverySources: [{ label: "Від знайомих", count: 2 }],
      institutions: [{ label: "ВНТУ", count: 3 }],
      courses: [{ label: "2", count: 2 }],
    });
    expect(query).toHaveBeenCalledTimes(5);
  });
});
