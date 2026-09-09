import { describe, expect, it, vi } from "vitest";

import {
  hasCurrentRulesAcceptance,
  saveRegistration,
} from "../src/services/registration.service.js";
import type { UserRepository } from "../src/repositories/users.repository.js";

function repository(): UserRepository {
  return {
    exists: vi.fn(async () => false),
    findByTelegramUserId: vi.fn(async () => null),
    save: vi.fn(async () => undefined),
    deleteByTelegramUserId: vi.fn(async () => true),
    acceptRules: vi.fn(async () => true),
    list: vi.fn(async () => ({ users: [], total: 0 })),
  };
}

const config = { privacyPolicyVersion: "2026-01", eventRulesVersion: "2026-01" };

describe("registration service", () => {
  it("recognizes only a timestamped acceptance of the current version", () => {
    expect(
      hasCurrentRulesAcceptance(
        {
          eventRulesConsent: true,
          eventRulesConsentAt: new Date("2026-08-20T14:30:00.000Z"),
          eventRulesVersion: "2026-01",
        },
        "2026-01",
      ),
    ).toBe(true);
    expect(
      hasCurrentRulesAcceptance(
        {
          eventRulesConsent: true,
          eventRulesConsentAt: new Date("2026-08-20T14:30:00.000Z"),
          eventRulesVersion: "2025-01",
        },
        "2026-01",
      ),
    ).toBe(false);
    expect(
      hasCurrentRulesAcceptance(
        { eventRulesConsent: true, eventRulesConsentAt: null, eventRulesVersion: "2026-01" },
        "2026-01",
      ),
    ).toBe(false);
  });

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
        rulesAcceptedAt: "2026-08-20T14:30:00.000Z",
        rulesVersion: "2026-01",
      },
      ["12 листопада | 17:00 | Оксана Ломич | Бізнес"],
      config,
    );
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({ telegramUsername: "@alice" }),
    );
    expect(users.save).toHaveBeenCalledWith(
      expect.objectContaining({
        consent: {
          personalDataPolicyVersion: "2026-01",
          eventRulesVersion: "2026-01",
          eventRulesConsentAt: new Date("2026-08-20T14:30:00.000Z"),
        },
      }),
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
        rulesAcceptedAt: "2026-08-20T14:30:00.000Z",
        rulesVersion: "2026-01",
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
      rulesAcceptedAt: "2026-08-20T14:30:00.000Z",
      rulesVersion: "2026-01",
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

  it("rejects registration without explicit acceptance of current rules", async () => {
    const users = repository();
    await expect(
      saveRegistration(
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
        ["Бізнес"],
        config,
      ),
    ).rejects.toThrow("REGISTRATION_RULES_NOT_ACCEPTED");
    expect(users.save).not.toHaveBeenCalled();
  });

  it("rejects acceptance of an old rules version", async () => {
    const users = repository();
    await expect(
      saveRegistration(
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
          rulesAcceptedAt: "2026-08-20T14:30:00.000Z",
          rulesVersion: "2025-01",
        },
        ["Бізнес"],
        config,
      ),
    ).rejects.toThrow("REGISTRATION_RULES_NOT_ACCEPTED");
    expect(users.save).not.toHaveBeenCalled();
  });
});
