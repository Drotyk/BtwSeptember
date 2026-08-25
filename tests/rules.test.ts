import { describe, expect, it } from "vitest";
import { getRulesChunks } from "../src/services/rules.service.js";
import fs from "node:fs";
import path from "node:path";

describe("rules.service", () => {
  describe("getRulesChunks", () => {
    it("returns non-empty array of chunks", async () => {
      // Ensure content/rules.md exists for the test or it might fail if run in environment without it.
      // Usually, it's expected to be present for the service to work.
      const rulesPath = path.resolve(process.cwd(), 'content/rules.md');
      if (!fs.existsSync(rulesPath)) {
        // Create a dummy rules file if it doesn't exist for test isolation
        const contentDir = path.dirname(rulesPath);
        if (!fs.existsSync(contentDir)) {
          fs.mkdirSync(contentDir, { recursive: true });
        }
        fs.writeFileSync(rulesPath, "Правила\n\nSome long text that gets split if needed.");
      }

      const chunks = await getRulesChunks();
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(4000);
      }
      
      const fullText = chunks.join("");
      expect(fullText.includes("Правила") || fullText.length > 0).toBe(true);
    });
  });
});
