import { describe, expect, it } from "vitest";
import supertest from "supertest";
import argon2 from "argon2";
import type { Pool } from "pg";

import { startWebServer, stopWebServer } from "../src/web.js";

describe("web security and health endpoints", () => {
  it("protects users, supports login, and reports health", async () => {
    const pool = {
      query: async () => ({ rows: [{}], rowCount: 1 }),
    } as unknown as Pool;
    const server = await startWebServer(
      pool,
      {
        botToken: "test",
        databaseUrl: "postgres://test",
        webHost: "127.0.0.1",
        webPort: 0,
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
        nodeEnvironment: "test",
      },
      async () => true,
    );
    try {
      const client = supertest(server);
      expect((await client.get("/health/live")).status).toBe(200);
      expect((await client.get("/health/ready")).status).toBe(200);
      expect((await client.get("/api/users")).status).toBe(401);
      expect(
        (await client.post("/api/login").send({ username: "admin", password: "wrong" })).status,
      ).toBe(401);
      const login = await client.post("/api/login").send({ username: "admin", password: "secret" });
      expect(login.status).toBe(200);
      const users = await client.get("/api/users").set("Cookie", login.headers["set-cookie"]);
      expect(users.status).toBe(200);
    } finally {
      await stopWebServer(server);
    }
  });
});
