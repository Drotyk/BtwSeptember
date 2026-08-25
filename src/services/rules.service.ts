import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const RULES_FILE = resolve(process.cwd(), "content/rules.md");
const MAX_CHUNK_LENGTH = 4000;
let cachedChunks: string[] | null = null;

export async function getRulesChunks(): Promise<string[]> {
  if (cachedChunks) return cachedChunks;
  const content = await readFile(RULES_FILE, "utf8");
  const chunks = splitIntoChunks(content.trim(), MAX_CHUNK_LENGTH);
  cachedChunks = chunks;
  return chunks;
}

function splitIntoChunks(text: string, maxLength: number): string[] {
  // Split at paragraph boundaries (\n\n)
  // If a single paragraph > maxLength, split at line boundaries (\n)
  // If a single line > maxLength, split at maxLength char boundary
  const paragraphs = text.split("\n\n");
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    const candidate = current ? current + "\n\n" + para : para;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      if (current) chunks.push(current);
      if (para.length <= maxLength) {
        current = para;
      } else {
        // Split large paragraph by lines
        const lines = para.split("\n");
        current = "";
        for (const line of lines) {
          const lineCandidate = current ? current + "\n" + line : line;
          if (lineCandidate.length <= maxLength) {
            current = lineCandidate;
          } else {
            if (current) chunks.push(current);
            current = line.length <= maxLength ? line : line.slice(0, maxLength);
          }
        }
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
