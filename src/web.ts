import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";

import { createAdminAuth, type AdminAuth } from "./web/auth.js";
import type { Settings } from "./config.js";
import { TRAININGS, getTrainingLabel } from "./form.js";
import { createUsersRepository } from "./repositories/users.repository.js";

const INDEX_FILE = resolve(process.cwd(), "public/index.html");
const LOGIN_FILE = resolve(process.cwd(), "public/login.html");
const APP_SCRIPT_FILE = resolve(process.cwd(), "public/app.js");
const LOGIN_SCRIPT_FILE = resolve(process.cwd(), "public/login.js");
const MAX_BODY_BYTES = 16 * 1024;

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  setSecurityHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
  });
  response.end(JSON.stringify(body));
}

async function sendFile(
  response: ServerResponse,
  file: string,
  contentType: string,
): Promise<void> {
  setSecurityHeaders(response);
  response.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
  });
  response.end(await readFile(file));
}

function getPaginationValue(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function readBody(request: IncomingMessage): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(typeof chunk === "string" ? chunk : (chunk as Uint8Array));
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function clientKey(request: IncomingMessage): string {
  return request.socket.remoteAddress ?? "unknown";
}

async function handleLogin(
  request: IncomingMessage,
  response: ServerResponse,
  auth: AdminAuth,
): Promise<void> {
  let body: unknown;
  try {
    body = JSON.parse(await readBody(request));
  } catch {
    sendJson(response, 401, { error: "Неправильний логін або пароль" });
    return;
  }
  const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const username = typeof record.username === "string" ? record.username : "";
  const password = typeof record.password === "string" ? record.password : "";
  const result = await auth.authenticate(username, password, clientKey(request));
  if (result !== "ok") {
    sendJson(response, result === "rate_limited" ? 429 : 401, {
      error: "Неправильний логін або пароль",
    });
    return;
  }
  await auth.login(response);
  sendJson(response, 200, { ok: true });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  pool: Pool,
  settings: Settings,
  auth: AdminAuth,
  readiness: () => Promise<boolean>,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (url.pathname === "/health/live" && request.method === "GET") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (url.pathname === "/health/ready" && request.method === "GET") {
    const ready = await readiness();
    sendJson(response, ready ? 200 : 503, { status: ready ? "ready" : "not_ready" });
    return;
  }

  if (url.pathname === "/login" && request.method === "GET") {
    await sendFile(response, LOGIN_FILE, "text/html; charset=utf-8");
    return;
  }

  if (url.pathname === "/app.js" && request.method === "GET") {
    await sendFile(response, APP_SCRIPT_FILE, "text/javascript; charset=utf-8");
    return;
  }

  if (url.pathname === "/login.js" && request.method === "GET") {
    await sendFile(response, LOGIN_SCRIPT_FILE, "text/javascript; charset=utf-8");
    return;
  }

  if (url.pathname === "/api/login" && request.method === "POST") {
    await handleLogin(request, response, auth);
    return;
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }
    await auth.logout(request, response);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/" && request.method === "GET") {
    if (!(await auth.isAuthenticated(request))) {
      await sendFile(response, LOGIN_FILE, "text/html; charset=utf-8");
      return;
    }
    await sendFile(response, INDEX_FILE, "text/html; charset=utf-8");
    return;
  }

  if (url.pathname !== "/api/users" || request.method !== "GET") {
    sendJson(response, 404, { error: "Сторінку не знайдено" });
    return;
  }

  if (!(await auth.isAuthenticated(request))) {
    sendJson(response, 401, { error: "Необхідна авторизація" });
    return;
  }

  const page = getPaginationValue(url.searchParams.get("page"), 1);
  const pageSize = Math.min(getPaginationValue(url.searchParams.get("pageSize"), 20), 100);
  const search = (url.searchParams.get("search") ?? "").trim().slice(0, 100);
  const result = await createUsersRepository(pool).list({ page, pageSize, search });
  sendJson(response, 200, {
    users: result.users.map((user) => ({
      ...user,
      trainingDisplay: (user.trainingIds ?? []).map((id) => {
        const training = TRAININGS.find((candidate) => candidate.id === id);
        return training ? getTrainingLabel(training) : id;
      }),
    })),
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    },
  });
}

export function startWebServer(
  pool: Pool,
  settings: Settings,
  readiness: () => Promise<boolean>,
): Promise<ReturnType<typeof createServer>> {
  const auth = createAdminAuth(settings, pool);
  const server = createServer((request, response) => {
    void handleRequest(request, response, pool, settings, auth, readiness).catch(() => {
      if (!response.headersSent) sendJson(response, 500, { error: "Внутрішня помилка сервера" });
      else response.destroy();
    });
  });

  return new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(settings.webPort, settings.webHost, () => {
      server.off("error", reject);
      console.info(`Веб-інтерфейс BTW запущений на порту ${settings.webPort}`);
      resolvePromise(server);
    });
  });
}

export function stopWebServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    if (!server.listening) {
      resolvePromise();
      return;
    }
    server.close((error) => (error ? reject(error) : resolvePromise()));
  });
}
