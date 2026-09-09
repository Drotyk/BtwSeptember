import type { Pool } from "pg";

export interface StatisticsBreakdownItem {
  label: string;
  count: number;
}

export interface TrainingStatisticsItem {
  id: string;
  count: number;
}

export interface UserStatistics {
  totalUsers: number;
  usersWithTraining: number;
  totalTrainingSelections: number;
  trainingSelections: TrainingStatisticsItem[];
  discoverySources: StatisticsBreakdownItem[];
  institutions: StatisticsBreakdownItem[];
  courses: StatisticsBreakdownItem[];
}

interface SummaryRow {
  totalUsers: string;
  usersWithTraining: string;
  totalTrainingSelections: string;
}

function toNumber(value: string | number | null | undefined): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export function createStatisticsRepository(pool: Pool) {
  return {
    async getUsersStatistics(): Promise<UserStatistics> {
      const [summaryResult, trainingResult, sourceResult, institutionResult, courseResult] =
        await Promise.all([
          pool.query<SummaryRow>(`
            SELECT
              COUNT(*)::text AS "totalUsers",
              COUNT(*) FILTER (
                WHERE COALESCE(cardinality(training_ids), 0) > 0
                   OR COALESCE(cardinality(trainings), 0) > 0
              )::text AS "usersWithTraining",
              COALESCE(
                SUM(
                  CASE
                    WHEN COALESCE(cardinality(training_ids), 0) > 0 THEN cardinality(training_ids)
                    ELSE COALESCE(cardinality(trainings), 0)
                  END
                ),
                0
              )::text AS "totalTrainingSelections"
            FROM users
          `),
          pool.query<TrainingStatisticsItem>(`
            SELECT selected_training.id, COUNT(*)::int AS count
            FROM users
            CROSS JOIN LATERAL unnest(
              CASE
                WHEN COALESCE(cardinality(training_ids), 0) > 0 THEN training_ids
                ELSE COALESCE(trainings, ARRAY[]::text[])
              END
            ) AS selected_training(id)
            GROUP BY selected_training.id
            ORDER BY count DESC, id ASC
          `),
          pool.query<StatisticsBreakdownItem>(`
            SELECT
              COALESCE(NULLIF(BTRIM(discovery_source), ''), 'Не вказано') AS label,
              COUNT(*)::int AS count
            FROM users
            GROUP BY 1
            ORDER BY count DESC, label ASC
          `),
          pool.query<StatisticsBreakdownItem>(`
            SELECT
              COALESCE(NULLIF(BTRIM(institution), ''), 'Не вказано') AS label,
              COUNT(*)::int AS count
            FROM users
            GROUP BY 1
            ORDER BY count DESC, label ASC
          `),
          pool.query<StatisticsBreakdownItem>(`
            SELECT
              COALESCE(NULLIF(BTRIM(course), ''), 'Не вказано') AS label,
              COUNT(*)::int AS count
            FROM users
            GROUP BY 1
            ORDER BY count DESC, label ASC
          `),
        ]);

      const summary = summaryResult.rows[0];
      return {
        totalUsers: toNumber(summary?.totalUsers),
        usersWithTraining: toNumber(summary?.usersWithTraining),
        totalTrainingSelections: toNumber(summary?.totalTrainingSelections),
        trainingSelections: trainingResult.rows.map((row) => ({
          id: row.id,
          count: toNumber(row.count),
        })),
        discoverySources: sourceResult.rows.map((row) => ({
          label: row.label,
          count: toNumber(row.count),
        })),
        institutions: institutionResult.rows.map((row) => ({
          label: row.label,
          count: toNumber(row.count),
        })),
        courses: courseResult.rows.map((row) => ({
          label: row.label,
          count: toNumber(row.count),
        })),
      };
    },
  };
}
