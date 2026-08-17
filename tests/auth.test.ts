import { describe, expect, it, vi } from "vitest";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import argon2 from "argon2";
import type { Pool } from "pg";

import { createAdminAuth, LoginRateLimiter } from "../src/web/auth.js";

describe("admin login rate limiter", () => {
  it("limits repeated attempts and resets after success", () => {
    const limiter = new LoginRateLimiter(2, 60_000);
    expect(limiter.isAllowed("test-client")).toBe(true);
    limiter.registerFailure("test-client");
    limiter.registerFailure("test-client");
    expect(limiter.isAllowed("test-client")).toBe(false);
    limiter.clear("test-client");
    expect(limiter.isAllowed("test-client")).toBe(true);
  });

  it("authenticates, creates, refreshes and removes a server-side session", async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [{}], rowCount: 1 })),
    } as unknown as Pool;
    const settings = {
      botToken: "test",
      databaseUrl: "postgres://test",
      webHost: "127.0.0.1",
      webPort: 3000,
      chatInviteLink: "",
      privacyPolicyUrl: "https://example.com/privacy",
      eventRulesUrl: "https://example.com/rules",
      privacyPolicyVersion: "test",
      eventRulesVersion: "test",
      adminUsername: "admin",
      adminPasswordHash: await argon2.hash("secret", { type: argon2.argon2id }),
      sessionTtlMs: 1_800_000,
      adminSessionTtlMs: 3_600_000,
      secureCookies: false,
      dropPendingUpdates: false,
      nodeEnvironment: "test" as const,
    };
    const auth = createAdminAuth(settings, pool);
    expect(await auth.authenticate("admin", "wrong", "client")).toBe("invalid");
    expect(await auth.authenticate("admin", "secret", "client")).toBe("ok");

    const request = new IncomingMessage(new Socket());
    const response = new ServerResponse(request);
    await auth.login(response);
    const cookie = response.getHeader("set-cookie");
    expect(cookie).toBeTruthy();
    const cookieValue = String(cookie).split(";", 1)[0];
    request.headers.cookie = cookieValue;
    expect(await auth.isAuthenticated(request)).toBe(true);
    await auth.logout(request, response);
  });
});
