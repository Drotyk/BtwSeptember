import { describe, expect, it, vi } from "vitest";

import {
  createSpeakerService,
  SpeakerValidationError,
  validateSpeakerInput,
} from "../src/services/speaker.service.js";
import type {
  SpeakerInput,
  SpeakerRecord,
  SpeakerRepository,
} from "../src/repositories/speakers.repository.js";

function input(overrides: Partial<SpeakerInput> = {}): SpeakerInput {
  return {
    trainingId: "leadership",
    name: "Євген Мартинюк",
    description: "Senior Frontend Developer у Syntax.",
    detailedDescription: "Senior Frontend Developer у Syntax. Детальний опис.",
    photoFileId: "AgAC-photo-id",
    sortOrder: 1,
    isActive: true,
    ...overrides,
  };
}

function record(overrides: Partial<SpeakerRecord> = {}): SpeakerRecord {
  return {
    id: "1",
    ...input(),
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function fakeRepository(): SpeakerRepository & { records: SpeakerRecord[] } {
  const repository = {
    records: [] as SpeakerRecord[],
    list: vi.fn(async (trainingId?: string, activeOnly = false) =>
      repository.records.filter(
        (speaker) =>
          (!trainingId || speaker.trainingId === trainingId) && (!activeOnly || speaker.isActive),
      ),
    ),
    findById: vi.fn(
      async (id: number) => repository.records.find((speaker) => speaker.id === String(id)) ?? null,
    ),
    create: vi.fn(async (value: SpeakerInput) => {
      const created = record({ ...value, id: String(repository.records.length + 1) });
      repository.records.push(created);
      return created;
    }),
    update: vi.fn(async (id: number, value: SpeakerInput) => {
      const index = repository.records.findIndex((speaker) => speaker.id === String(id));
      if (index < 0) return null;
      repository.records[index] = record({ ...repository.records[index], ...value });
      return repository.records[index];
    }),
    delete: vi.fn(async (id: number) => {
      const before = repository.records.length;
      repository.records = repository.records.filter((speaker) => speaker.id !== String(id));
      return repository.records.length < before;
    }),
  };
  return repository;
}

describe("speaker validation", () => {
  it("trims valid fields", () => {
    expect(validateSpeakerInput(input({ name: "  Тест  " })).name).toBe("Тест");
  });

  it.each([
    ["empty name", { name: "" }],
    ["too long name", { name: "x".repeat(101) }],
    ["empty description", { description: "" }],
    ["too long description", { description: "x".repeat(2001) }],
    ["empty detailed description", { detailedDescription: "" }],
    ["too long detailed description", { detailedDescription: "x".repeat(4001) }],
    ["unknown training", { trainingId: "unknown" }],
    ["negative order", { sortOrder: -1 }],
    ["fractional order", { sortOrder: 1.5 }],
    ["active speaker without photo", { photoFileId: null }],
    ["unknown local asset", { photoFileId: "asset:unknown" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => validateSpeakerInput(input(overrides))).toThrow(SpeakerValidationError);
  });

  it("accepts bundled speaker assets", () => {
    expect(validateSpeakerInput(input({ photoFileId: "asset:serhiy-prytula" })).photoFileId).toBe(
      "asset:serhiy-prytula",
    );
  });
});

describe("speaker service", () => {
  it("creates, finds, updates, deactivates and deletes a speaker", async () => {
    const repository = fakeRepository();
    const service = createSpeakerService(repository);
    const created = await service.create(input());
    expect(await service.findById(1)).toEqual(created);
    const updated = await service.update(1, { name: "Анна Коваль" });
    expect(updated?.name).toBe("Анна Коваль");
    const hidden = await service.update(1, { isActive: false });
    expect(hidden?.isActive).toBe(false);
    expect((await service.list("cybersecurity", true)).length).toBe(0);
    expect(await service.delete(1)).toBe(true);
    expect(await service.findById(1)).toBeNull();
  });

  it("returns speakers scoped to a training", async () => {
    const repository = fakeRepository();
    repository.records.push(
      record({ id: "1", sortOrder: 2 }),
      record({ id: "2", sortOrder: 1, trainingId: "acting" }),
      record({ id: "3", sortOrder: 1 }),
    );
    const speakers = await createSpeakerService(repository).list("leadership");
    expect(speakers.map((speaker) => speaker.id)).toEqual(["1", "3"]);
  });
});
