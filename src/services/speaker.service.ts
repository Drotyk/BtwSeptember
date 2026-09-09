import { getTraining } from "../form.js";
import { speakerAssetId } from "../speaker-assets.js";
import type {
  SpeakerInput,
  SpeakerRecord,
  SpeakerRepository,
} from "../repositories/speakers.repository.js";

export class SpeakerValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpeakerValidationError";
  }
}

export function validateSpeakerInput(input: Partial<SpeakerInput>): SpeakerInput {
  const trainingId = typeof input.trainingId === "string" ? input.trainingId.trim() : "";
  if (!trainingId || !getTraining(trainingId))
    throw new SpeakerValidationError("Оберіть коректний тренінг");

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) throw new SpeakerValidationError("Ім’я спікера є обов’язковим");
  if (name.length > 100)
    throw new SpeakerValidationError("Ім’я спікера не може бути довшим за 100 символів");

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!description) throw new SpeakerValidationError("Опис спікера є обов’язковим");
  if (description.length > 2000)
    throw new SpeakerValidationError("Опис не може бути довшим за 2000 символів");

  const detailedDescription =
    typeof input.detailedDescription === "string" ? input.detailedDescription.trim() : "";
  if (!detailedDescription)
    throw new SpeakerValidationError("Детальний опис спікера є обов’язковим");
  if (detailedDescription.length > 4000)
    throw new SpeakerValidationError("Детальний опис не може бути довшим за 4000 символів");

  const photoFileId =
    typeof input.photoFileId === "string" && input.photoFileId.trim()
      ? input.photoFileId.trim()
      : null;
  if (photoFileId && photoFileId.length > 512) {
    throw new SpeakerValidationError("Telegram file_id не може бути довшим за 512 символів");
  }
  if (photoFileId?.startsWith("asset:") && !speakerAssetId(photoFileId)) {
    throw new SpeakerValidationError("Локальний asset фото не знайдено");
  }

  const sortOrder = input.sortOrder;
  if (!Number.isInteger(sortOrder) || (sortOrder as number) < 0) {
    throw new SpeakerValidationError("Порядок має бути невід’ємним цілим числом");
  }

  const isActive = input.isActive;
  if (typeof isActive !== "boolean") throw new SpeakerValidationError("Некоректний статус спікера");
  if (isActive && !photoFileId) {
    throw new SpeakerValidationError("Для активного спікера потрібно вказати фото");
  }

  return {
    trainingId,
    name,
    description,
    detailedDescription,
    photoFileId,
    sortOrder: sortOrder as number,
    isActive,
  };
}

export interface SpeakerService {
  list(trainingId?: string, activeOnly?: boolean): Promise<SpeakerRecord[]>;
  findById(id: number): Promise<SpeakerRecord | null>;
  create(input: Partial<SpeakerInput>): Promise<SpeakerRecord>;
  update(id: number, input: Partial<SpeakerInput>): Promise<SpeakerRecord | null>;
  delete(id: number): Promise<boolean>;
}

export function createSpeakerService(repository: SpeakerRepository): SpeakerService {
  return {
    list: (trainingId, activeOnly) => repository.list(trainingId, activeOnly),
    findById: (id) => repository.findById(id),
    async create(input) {
      return repository.create(validateSpeakerInput(input));
    },
    async update(id, input) {
      const current = await repository.findById(id);
      if (!current) return null;
      return repository.update(id, validateSpeakerInput({ ...current, ...input }));
    },
    delete: (id) => repository.delete(id),
  };
}
