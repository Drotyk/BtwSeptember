import type { Pool } from "pg";

export interface SpeakerRecord {
  id: string;
  trainingId: string;
  name: string;
  description: string;
  detailedDescription: string;
  photoFileId: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SpeakerInput {
  trainingId: string;
  name: string;
  description: string;
  detailedDescription: string;
  photoFileId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface SpeakerRepository {
  list(trainingId?: string, activeOnly?: boolean): Promise<SpeakerRecord[]>;
  findById(id: number): Promise<SpeakerRecord | null>;
  create(input: SpeakerInput): Promise<SpeakerRecord>;
  update(id: number, input: SpeakerInput): Promise<SpeakerRecord | null>;
  delete(id: number): Promise<boolean>;
}

const SPEAKER_COLUMNS = `
  id,
  training_id AS "trainingId",
  name,
  description,
  detailed_description AS "detailedDescription",
  photo_file_id AS "photoFileId",
  sort_order AS "sortOrder",
  is_active AS "isActive",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export function createSpeakersRepository(pool: Pool): SpeakerRepository {
  return {
    async list(trainingId, activeOnly = false) {
      const conditions: string[] = [];
      const params: unknown[] = [];
      if (trainingId) {
        params.push(trainingId);
        conditions.push(`training_id = $${params.length}`);
      }
      if (activeOnly) conditions.push("is_active = TRUE");
      const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
      const result = await pool.query<SpeakerRecord>(
        `SELECT ${SPEAKER_COLUMNS}
         FROM speakers ${where}
         ORDER BY sort_order ASC, created_at ASC, id ASC`,
        params,
      );
      return result.rows;
    },

    async findById(id) {
      const result = await pool.query<SpeakerRecord>(
        `SELECT ${SPEAKER_COLUMNS} FROM speakers WHERE id = $1`,
        [id],
      );
      return result.rows[0] ?? null;
    },

    async create(input) {
      const result = await pool.query<SpeakerRecord>(
        `INSERT INTO speakers
           (training_id, name, description, detailed_description, photo_file_id, sort_order, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${SPEAKER_COLUMNS}`,
        [
          input.trainingId,
          input.name,
          input.description,
          input.detailedDescription,
          input.photoFileId,
          input.sortOrder,
          input.isActive,
        ],
      );
      return result.rows[0];
    },

    async update(id, input) {
      const result = await pool.query<SpeakerRecord>(
        `UPDATE speakers
         SET training_id = $2,
             name = $3,
             description = $4,
             detailed_description = $5,
             photo_file_id = $6,
             sort_order = $7,
             is_active = $8,
             updated_at = NOW()
         WHERE id = $1
         RETURNING ${SPEAKER_COLUMNS}`,
        [
          id,
          input.trainingId,
          input.name,
          input.description,
          input.detailedDescription,
          input.photoFileId,
          input.sortOrder,
          input.isActive,
        ],
      );
      return result.rows[0] ?? null;
    },

    async delete(id) {
      const result = await pool.query("DELETE FROM speakers WHERE id = $1", [id]);
      return (result.rowCount ?? 0) > 0;
    },
  };
}
