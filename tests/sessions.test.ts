import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";

import {
  createSessionStorage,
  deleteExpiredSessions,
  privateSessionKey,
} from "../src/repositories/sessions.repository.js";

describe("PostgreSQL session storage", () => {
  it("keys sessions by Telegram user only in private chats", () => {
    expect(privateSessionKey({ chat: { type: "private", id: 1 }, from: { id: 42 } })).toBe(
      "telegram:42",
    );
    expect(privateSessionKey({ chat: { type: "group", id: 1 }, from: { id: 42 } })).toBeUndefined();
  });

  it("reads, writes, deletes and cleans expired sessions", async () => {
    const query = vi
      .fn()
      .mockResolvedValue({ rows: [{ data: { registration: { step: "name" } } }], rowCount: 1 });
    const pool = { query } as unknown as Pool;
    const storage = createSessionStorage(pool, 60_000);
    expect(await storage.read("telegram:42")).toEqual({ registration: { step: "name" } });
    await storage.write("telegram:42", { registration: { step: "phone" } });
    await storage.delete("telegram:42");
    await deleteExpiredSessions(pool);
    expect(query).toHaveBeenCalled();
  });
});
