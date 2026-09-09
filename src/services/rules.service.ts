import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const RULES_FILE = resolve(process.cwd(), "content/rules.md");
// Keep room for the version footer and stay below Telegram's 4096-character limit.
const MAX_CHUNK_LENGTH = 3800;

export interface CurrentRules {
  version: string;
  chunks: string[];
}

export interface RulesService {
  getCurrentRules(): Promise<CurrentRules>;
}

export async function getRulesChunks(): Promise<string[]> {
  const content = await readFile(RULES_FILE, "utf8");
  return splitIntoChunks(content.trim(), MAX_CHUNK_LENGTH);
}

export async function getCurrentRules(version: string): Promise<CurrentRules> {
  return { version, chunks: await getRulesChunks() };
}

export function createRulesService(version: string): RulesService {
  return { getCurrentRules: () => getCurrentRules(version) };
}

export function splitIntoChunks(text: string, maxLength: number): string[] {
  if (maxLength < 1) throw new Error("maxLength must be positive");

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    const boundary = findBoundary(remaining, maxLength);
    chunks.push(remaining.slice(0, boundary));
    remaining = remaining.slice(boundary);
  }

  if (remaining) {
    chunks.push(remaining);
  }
  return chunks;
}

function findBoundary(text: string, maxLength: number): number {
  const paragraphBoundary = text.lastIndexOf("\n\n", maxLength);
  if (paragraphBoundary > 0) return paragraphBoundary;

  const lineBoundary = text.lastIndexOf("\n", maxLength);
  if (lineBoundary > 0) return lineBoundary;

  return maxLength;
}
