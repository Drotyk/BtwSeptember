import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import argon2 from "argon2";
import type { Pool } from "pg";

import type { Settings } from "../config.js";
import {
  createAdminSessionsRepository,
  type AdminSessionRepository,
} from "../repositories/admin-sessions.repository.js";

export const ADMIN_COOKIE_NAME = "__Host-btw_admin";
const DEVELOPMENT_COOKIE_NAME = "btw_admin";

interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

export class LoginRateLimiter {
  private readonly attempts = new Map<string, RateLimitEntry>();

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 15 * 60 * 1000,
  ) {}

  isAllowed(key: string): boolean {
    const entry = this.attempts.get(key);
    if (!entry || entry.resetAt <= Date.now()) return true;
    return entry.attempts < this.maxAttempts;
  }

  registerFailure(key: string): void {
    const now = Date.now();
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) {
      this.attempts.set(key, { attempts: 1, resetAt: now + this.windowMs });
      return;
    }
    current.attempts += 1;
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function getCookie(request: IncomingMessage, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const value of header.split(";")) {
    const [key, ...parts] = value.trim().split("=");
    if (key === name) return decodeURIComponent(parts.join("="));
  }
  return null;
}

function cookieHeader(name: string, value: string, secure: boolean, maxAge: number): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export interface AdminAuth {
  authenticate(
    username: string,
    password: string,
    key: string,
  ): Promise<"ok" | "invalid" | "rate_limited">;
  isAuthenticated(request: IncomingMessage): Promise<boolean>;
  login(response: ServerResponse): Promise<void>;
  logout(request: IncomingMessage, response: ServerResponse): Promise<void>;
}

export function createAdminAuth(settings: Settings, pool: Pool): AdminAuth {
  const sessions: AdminSessionRepository = createAdminSessionsRepository(pool);
  const limiter = new LoginRateLimiter();
  const cookieName = settings.secureCookies ? ADMIN_COOKIE_NAME : DEVELOPMENT_COOKIE_NAME;

  return {
    async authenticate(username, password, key) {
      if (!limiter.isAllowed(key)) return "rate_limited";
      try {
        const suppliedUsername = Buffer.from(username);
        const configuredUsername = Buffer.from(settings.adminUsername);
        const usernamesMatch = timingSafeEqual(
          suppliedUsername.length === configuredUsername.length
            ? suppliedUsername
            : Buffer.alloc(configuredUsername.length),
          configuredUsername,
        );
        if (usernamesMatch && (await argon2.verify(settings.adminPasswordHash, password))) {
          limiter.clear(key);
          return "ok";
        }
      } catch {
        // Invalid hashes and malformed input are deliberately indistinguishable from bad credentials.
      }
      limiter.registerFailure(key);
      return "invalid";
    },

    async isAuthenticated(request) {
      const rawToken = getCookie(request, cookieName);
      if (!rawToken) return false;
      const tokenHash = hashToken(rawToken);
      const valid = await sessions.findValid(tokenHash);
      if (!valid) return false;
      await sessions.touch(tokenHash, new Date(Date.now() + settings.adminSessionTtlMs));
      return true;
    },

    async login(response) {
      const rawToken = randomBytes(32).toString("base64url");
      await sessions.create(hashToken(rawToken), new Date(Date.now() + settings.adminSessionTtlMs));
      response.setHeader(
        "Set-Cookie",
        cookieHeader(
          cookieName,
          rawToken,
          settings.secureCookies,
          Math.floor(settings.adminSessionTtlMs / 1000),
        ),
      );
    },

    async logout(request, response) {
      const rawToken = getCookie(request, cookieName);
      if (rawToken) await sessions.delete(hashToken(rawToken));
      response.setHeader("Set-Cookie", cookieHeader(cookieName, "", settings.secureCookies, 0));
    },
  };
}
