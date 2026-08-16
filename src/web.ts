import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";

interface UserRow {
  id: string;
  telegramUserId: string;
  phoneNumber: string;
  name: string;
  telegramUsername: string | null;
  institution: string | null;
  course: string | null;
  trainings: string[] | null;
  discoverySource: string | null;
  personalDataConsent: boolean;
  eventRulesConsent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const INDEX_FILE = resolve(process.cwd(), "public/index.html");

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

async function sendIndex(response: ServerResponse): Promise<void> {
  const html = await readFile(INDEX_FILE, "utf8");
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(html);
}

function getPaginationValue(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  pool: Pool,
): Promise<void> {
  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Метод не підтримується" });
    return;
  }

  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === "/") {
    await sendIndex(response);
    return;
  }

  if (url.pathname === "/health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (url.pathname !== "/api/users") {
    sendJson(response, 404, { error: "Сторінку не знайдено" });
    return;
  }

  const page = getPaginationValue(url.searchParams.get("page"), 1);
  const pageSize = Math.min(getPaginationValue(url.searchParams.get("pageSize"), 20), 100);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
  const offset = (page - 1) * pageSize;

  const [countResult, usersResult] = await Promise.all([
    pool.query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM users
      WHERE $1 = ''
         OR phone_number ILIKE '%' || $1 || '%'
         OR full_name ILIKE '%' || $1 || '%'
         OR telegram_username ILIKE '%' || $1 || '%'
         OR institution ILIKE '%' || $1 || '%'
         OR course ILIKE '%' || $1 || '%'
         OR COALESCE(array_to_string(trainings, ' '), '') ILIKE '%' || $1 || '%'
         OR discovery_source ILIKE '%' || $1 || '%'
         OR telegram_user_id::text ILIKE '%' || $1 || '%'
      `,
      [search],
    ),
    pool.query<UserRow>(
      `
      SELECT
          id,
          telegram_user_id AS "telegramUserId",
          phone_number AS "phoneNumber",
          full_name AS name,
          telegram_username AS "telegramUsername",
          institution,
          course,
          trainings,
          discovery_source AS "discoverySource",
          personal_data_consent AS "personalDataConsent",
          event_rules_consent AS "eventRulesConsent",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      FROM users
      WHERE $1 = ''
         OR phone_number ILIKE '%' || $1 || '%'
         OR full_name ILIKE '%' || $1 || '%'
         OR telegram_username ILIKE '%' || $1 || '%'
         OR institution ILIKE '%' || $1 || '%'
         OR course ILIKE '%' || $1 || '%'
         OR COALESCE(array_to_string(trainings, ' '), '') ILIKE '%' || $1 || '%'
         OR discovery_source ILIKE '%' || $1 || '%'
         OR telegram_user_id::text ILIKE '%' || $1 || '%'
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3
      `,
      [search, pageSize, offset],
    ),
  ]);

  const total = Number(countResult.rows[0]?.count ?? 0);
  sendJson(response, 200, {
    users: usersResult.rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

export function startWebServer(
  pool: Pool,
  host: string,
  port: number,
): Promise<ReturnType<typeof createServer>> {
  const server = createServer((request, response) => {
    void handleRequest(request, response, pool).catch((error: unknown) => {
      console.error("Помилка веб-запиту", error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "Внутрішня помилка сервера" });
      } else {
        response.destroy();
      }
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      console.info(`Веб-інтерфейс запущений: http://localhost:${port}`);
      resolve(server);
    });
  });
}

export function stopWebServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
