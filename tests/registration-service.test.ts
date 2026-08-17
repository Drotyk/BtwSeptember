import { describe, expect, it, vi } from "vitest";

import { saveRegistration } from "../src/services/registration.service.js";
import type { UserRepository } from "../src/repositories/users.repository.js";

function repository(): UserRepository {
  return {
    exists: vi.fn(async () => false),
    findByTelegramUserId: vi.fn(async () => null),
    save: vi.fn(async () => undefined),
    deleteByTelegramUserId: vi.fn(async () => true),
    list: vi.fn(async () => ({ users: [], total: 0 })),
  };
}

const config = { privacyPolicyVersion: "2026-01", eventRulesVersion: "2026-01" };

describe("registration service", () => {
  it("saves a new registration with a trusted username", async () => {
    const users = repository();
    await saveRegistration(
      users,
      10,
      "alice",
      {
        step: "rulesConsent",
        phoneNumber: "+380501234567",
        name: "Петренко Іван",
        institution: "ВНТУ",
        course: "2",
        trainingIds: ["business"],
        discoverySource: "мережі",
      },
      ["12 листопада | 17:00 | Оксана Ломич | Бізнес"],
      config,
    );
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ telegramUsername: "@alice" }),
    );
  });

  it("stores a missing username as null and supports editing", async () => {
    const users = repository();
    await saveRegistration(
      users,
      10,
      undefined,
      {
        step: "rulesConsent",
        isEditing: true,
        phoneNumber: "+380501234567",
        name: "Петренко Іван",
        institution: "ВНТУ",
        course: "2",
        trainingIds: ["business"],
        discoverySource: "мережі",
      },
      ["Бізнес"],
      config,
    );
    expect(users.save).toHaveBeenCalledWith(expect.objectContaining({ telegramUsername: null }));
  });

  it("uses the current Telegram username when a user edits the form", async () => {
    const users = repository();
    const state = {
      step: "rulesConsent" as const,
      phoneNumber: "+380501234567",
      name: "Петренко Іван",
      institution: "ВНТУ",
      course: "2",
      trainingIds: ["business"],
      discoverySource: "мережі",
    };
    await saveRegistration(users, 10, "old_name", state, ["Бізнес"], config);
    await saveRegistration(
      users,
      10,
      "new_name",
      { ...state, isEditing: true },
      ["Бізнес"],
      config,
    );
    expect(users.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ telegramUsername: "@new_name" }),
    );
  });

  it("rejects incomplete registration without saving", async () => {
    const users = repository();
    await expect(
      saveRegistration(users, 10, "alice", { step: "rulesConsent" }, [], config),
    ).rejects.toThrow("REGISTRATION_INCOMPLETE");
    expect(users.save).not.toHaveBeenCalled();
  });
});
