import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { Pool } from "pg";

import { createAdminAuth, type AdminAuth } from "./web/auth.js";
import type { Settings } from "./config.js";
import { TRAININGS, getTrainingLabel } from "./form.js";
import { createUsersRepository } from "./repositories/users.repository.js";
import { createNotificationsRepository } from "./repositories/notifications.repository.js";
import { validateNotificationInput } from "./services/notification.service.js";
import { createSpeakerService } from "./services/speaker.service.js";
import { SpeakerValidationError } from "./services/speaker.service.js";
import { createSpeakersRepository } from "./repositories/speakers.repository.js";
import { createStatisticsRepository } from "./repositories/statistics.repository.js";
import { listIncompleteRegistrations } from "./repositories/sessions.repository.js";
import { getSpeakerAsset, SPEAKER_ASSETS, speakerAssetPath } from "./speaker-assets.js";

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

function speakerId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function speakerInput(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

function percentage(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown> | null> {
  try {
    return speakerInput(JSON.parse(await readBody(request)));
  } catch {
    return null;
  }
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

  const speakerAssetRoute = /^\/speaker-assets\/([a-z0-9-]+)$/.exec(url.pathname);
  if (speakerAssetRoute && request.method === "GET") {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }
    const asset = speakerAssetRoute[1] ? getSpeakerAsset(speakerAssetRoute[1]) : undefined;
    if (!asset) {
      sendJson(response, 404, { error: "Фото не знайдено" });
      return;
    }
    await sendFile(response, speakerAssetPath(asset), asset.contentType);
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

  // ── Notification API ───────────────────────────────────────────────────

  if (url.pathname === "/api/trainings" && request.method === "GET") {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }
    const trainings = TRAININGS.filter((t) => t.active).map((t) => ({
      id: t.id,
      title: t.title,
      date: t.date,
      time: t.time,
      speaker: t.speaker,
      label: getTrainingLabel(t),
    }));
    sendJson(response, 200, { trainings });
    return;
  }

  // ── Speakers API ──────────────────────────────────────────────────────

  if (url.pathname === "/api/speaker-assets" && request.method === "GET") {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }
    sendJson(response, 200, {
      assets: SPEAKER_ASSETS.map(({ id, name, filename }) => ({ id, name, filename })),
    });
    return;
  }

  const speakerRoute = /^\/api\/speakers(?:\/([^/]+))?$/.exec(url.pathname);
  if (speakerRoute) {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }

    const service = createSpeakerService(createSpeakersRepository(pool));
    const id = speakerRoute[1] ? speakerId(speakerRoute[1]) : null;
    if (speakerRoute[1] && id === null) {
      sendJson(response, 400, { error: "Некоректний ID спікера" });
      return;
    }

    if (!id && request.method === "GET") {
      const trainingId = url.searchParams.get("trainingId")?.trim() || undefined;
      const speakers = await service.list(trainingId, false);
      sendJson(response, 200, { speakers });
      return;
    }

    if (id && request.method === "GET") {
      const speaker = await service.findById(id);
      if (!speaker) {
        sendJson(response, 404, { error: "Спікера не знайдено" });
        return;
      }
      sendJson(response, 200, { speaker });
      return;
    }

    if ((request.method === "POST" && !id) || (request.method === "PATCH" && id)) {
      const body = await readJsonBody(request);
      if (!body) {
        sendJson(response, 400, { error: "Невірний формат запиту" });
        return;
      }
      const input: Record<string, unknown> = {};
      if (typeof body.trainingId === "string") input.trainingId = body.trainingId;
      if (typeof body.name === "string") input.name = body.name;
      if (typeof body.description === "string") input.description = body.description;
      if (typeof body.detailedDescription === "string") {
        input.detailedDescription = body.detailedDescription;
      }
      if (body.photoFileId === null || typeof body.photoFileId === "string") {
        input.photoFileId = body.photoFileId;
      }
      if (typeof body.sortOrder === "number") {
        input.sortOrder = body.sortOrder;
      } else if (typeof body.sortOrder === "string" && body.sortOrder.trim() !== "") {
        input.sortOrder = Number(body.sortOrder);
      }
      if (typeof body.isActive === "boolean") input.isActive = body.isActive;

      try {
        const speaker = id ? await service.update(id, input) : await service.create(input);
        if (!speaker) {
          sendJson(response, 404, { error: "Спікера не знайдено" });
          return;
        }
        sendJson(response, id ? 200 : 201, { speaker });
      } catch (error) {
        if (error instanceof SpeakerValidationError) {
          sendJson(response, 400, { error: error.message });
          return;
        }
        throw error;
      }
      return;
    }

    if (id && request.method === "DELETE") {
      const deleted = await service.delete(id);
      if (!deleted) {
        sendJson(response, 404, { error: "Спікера не знайдено" });
        return;
      }
      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 405, { error: "Метод не підтримується" });
    return;
  }

  if (url.pathname === "/api/notifications/preview-count" && request.method === "POST") {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      sendJson(response, 400, { error: "Невірний формат запиту" });
      return;
    }
    const record =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const targetType = typeof record.targetType === "string" ? record.targetType : "all";
    const trainingId = typeof record.trainingId === "string" ? record.trainingId : null;
    const targetUserIds = Array.isArray(record.targetUserIds)
      ? (record.targetUserIds as number[])
      : null;
    const repo = createNotificationsRepository(pool);
    const count = await repo.countRecipients(targetType, trainingId, targetUserIds);
    sendJson(response, 200, { count });
    return;
  }

  if (url.pathname === "/api/notifications" && request.method === "POST") {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }
    let body: unknown;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      sendJson(response, 400, { error: "Невірний формат запиту" });
      return;
    }
    const record =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const title = typeof record.title === "string" ? record.title.trim() : "";
    const message = typeof record.message === "string" ? record.message.trim() : "";
    const targetType = typeof record.targetType === "string" ? record.targetType : "";
    const trainingId = typeof record.trainingId === "string" ? record.trainingId : undefined;
    const targetUserIds = Array.isArray(record.targetUserIds)
      ? (record.targetUserIds as number[])
      : undefined;
    const scheduledAt =
      typeof record.scheduledAt === "string" ? new Date(record.scheduledAt) : new Date();
    const expiresAt = typeof record.expiresAt === "string" ? new Date(record.expiresAt) : undefined;

    const validationError = validateNotificationInput({
      title,
      message,
      targetType: targetType as "all" | "training" | "user" | "custom",
      trainingId,
      targetUserIds,
      scheduledAt,
      expiresAt,
    });
    if (validationError) {
      sendJson(response, 400, { error: validationError });
      return;
    }

    const repo = createNotificationsRepository(pool);
    const notification = await repo.create({
      title,
      message,
      trainingId: trainingId ?? null,
      targetType,
      targetUserIds: targetUserIds ?? null,
      scheduledAt,
      expiresAt: expiresAt ?? null,
    });
    sendJson(response, 201, { notification });
    return;
  }

  if (url.pathname === "/api/notifications" && request.method === "GET") {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }
    const page = getPaginationValue(url.searchParams.get("page"), 1);
    const pageSize = Math.min(getPaginationValue(url.searchParams.get("pageSize"), 20), 100);
    const repo = createNotificationsRepository(pool);
    const result = await repo.list(page, pageSize);
    sendJson(response, 200, {
      notifications: result.notifications,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      },
    });
    return;
  }

  // Notification detail / actions: /api/notifications/:id[/action]
  const notificationMatch = /^\/api\/notifications\/([0-9]+)(\/[a-z-]+)?$/.exec(url.pathname);
  if (notificationMatch && notificationMatch[1]) {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }
    const notificationId = Number(notificationMatch[1]);
    const action = notificationMatch[2] ?? "";
    const repo = createNotificationsRepository(pool);

    if (action === "" && request.method === "GET") {
      const detail = await repo.findById(notificationId);
      if (!detail) {
        sendJson(response, 404, { error: "Оповіщення не знайдено" });
        return;
      }
      sendJson(response, 200, { notification: detail });
      return;
    }

    if (action === "/cancel" && request.method === "POST") {
      const cancelled = await repo.cancel(notificationId);
      if (!cancelled) {
        sendJson(response, 400, { error: "Неможливо скасувати це оповіщення" });
        return;
      }
      sendJson(response, 200, { ok: true });
      return;
    }

    if (action === "/retry-failed" && request.method === "POST") {
      const retried = await repo.retryFailed(notificationId);
      sendJson(response, 200, { ok: true, retried });
      return;
    }

    sendJson(response, 404, { error: "Сторінку не знайдено" });
    return;
  }

  // ── Users API ──────────────────────────────────────────────────────────

  if (url.pathname === "/api/statistics" && request.method === "GET") {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }

    const statistics = await createStatisticsRepository(pool).getUsersStatistics();
    const averageTrainingsPerUser =
      statistics.totalUsers > 0
        ? Math.round((statistics.totalTrainingSelections / statistics.totalUsers) * 10) / 10
        : 0;

    sendJson(response, 200, {
      summary: {
        totalUsers: statistics.totalUsers,
        usersWithTraining: statistics.usersWithTraining,
        usersWithoutTraining: statistics.totalUsers - statistics.usersWithTraining,
        totalTrainingSelections: statistics.totalTrainingSelections,
        averageTrainingsPerUser,
      },
      trainingSelections: statistics.trainingSelections.map((item) => {
        const training = TRAININGS.find(
          (candidate) => candidate.id === item.id || getTrainingLabel(candidate) === item.id,
        );
        return {
          id: item.id,
          label: training?.title ?? item.id,
          speaker: training?.speaker ?? "",
          count: item.count,
          percentage: percentage(item.count, statistics.totalUsers),
        };
      }),
      discoverySources: statistics.discoverySources.map((item) => ({
        ...item,
        percentage: percentage(item.count, statistics.totalUsers),
      })),
      institutions: statistics.institutions.map((item) => ({
        ...item,
        percentage: percentage(item.count, statistics.totalUsers),
      })),
      courses: statistics.courses.map((item) => ({
        ...item,
        percentage: percentage(item.count, statistics.totalUsers),
      })),
    });
    return;
  }

  if (url.pathname === "/api/incomplete-registrations" && request.method === "GET") {
    if (!(await auth.isAuthenticated(request))) {
      sendJson(response, 401, { error: "Необхідна авторизація" });
      return;
    }

    const registrations = await listIncompleteRegistrations(pool);
    sendJson(response, 200, { registrations });
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
