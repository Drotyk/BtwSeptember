import { describe, expect, it, vi } from "vitest";
import type { Context } from "grammy";
import { getCurrentRules, getRulesChunks, splitIntoChunks } from "../src/services/rules.service.js";
import { sendRules } from "../src/bot/rules.js";

describe("rules.service", () => {
  describe("getRulesChunks", () => {
    it("returns non-empty array of chunks", async () => {
      const chunks = await getRulesChunks();

      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThanOrEqual(1);

      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(4000);
      }

      const fullText = chunks.join("");
      expect(fullText.includes("Правила") || fullText.length > 0).toBe(true);
    });

    it("returns the trusted current version with the content", async () => {
      const rules = await getCurrentRules("1.0");
      expect(rules.version).toBe("1.0");
      expect(rules.chunks.join("")).toContain("Правила");
    });

    it("does not lose text when a line is longer than Telegram's limit", () => {
      const text = `start\n${"x".repeat(17)}\nend`;
      const chunks = splitIntoChunks(text, 10);
      expect(chunks.every((chunk) => chunk.length <= 10)).toBe(true);
      expect(chunks.join("")).toBe(text);
    });

    it("shows acceptance controls only when requested", async () => {
      const reply = vi.fn(async (): Promise<void> => undefined);
      await sendRules(
        { reply } as unknown as Context,
        {
          getCurrentRules: async () => ({ version: "1.1", chunks: ["Правила BTW"] }),
        },
        true,
      );

      expect(reply).toHaveBeenCalledWith("Правила BTW", expect.any(Object));
    });

    it("shows rules without buttons during ordinary viewing", async () => {
      const reply = vi.fn(async (): Promise<void> => undefined);
      await sendRules({ reply } as unknown as Context, {
        getCurrentRules: async () => ({ version: "1.1", chunks: ["Правила BTW"] }),
      });

      expect(reply).toHaveBeenCalledWith("Правила BTW");
    });

    it("hides the view-rules button during registration consent", async () => {
      const reply = vi.fn(async (): Promise<void> => undefined);
      await sendRules(
        { reply } as unknown as Context,
        { getCurrentRules: async () => ({ version: "1.1", chunks: ["Правила BTW"] }) },
        true,
      );

      const options = reply.mock.calls[0]?.[1] as {
        reply_markup: { inline_keyboard: Array<Array<Record<string, string>>> };
      };
      const callbackData = options.reply_markup.inline_keyboard
        .flat()
        .map((button) => button.callback_data)
        .filter((value): value is string => Boolean(value));
      expect(callbackData).toEqual(["rules:accept", "rules:decline", "rules:back"]);
    });

    it("shows a registration return button during ordinary viewing", async () => {
      const reply = vi.fn(async (): Promise<void> => undefined);
      await sendRules(
        { reply } as unknown as Context,
        { getCurrentRules: async () => ({ version: "1.1", chunks: ["Правила BTW"] }) },
        false,
        true,
      );

      const options = reply.mock.calls[0]?.[1] as {
        reply_markup: { inline_keyboard: Array<Array<Record<string, string>>> };
      };
      expect(options.reply_markup.inline_keyboard.flat()).toEqual([
        { text: "↩️ Повернутися до реєстрації", callback_data: "registration:return" },
      ]);
    });
  });
});
