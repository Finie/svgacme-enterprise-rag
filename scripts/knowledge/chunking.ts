import { createHash } from 'node:crypto';

export const CHUNKING_VERSION = 'section-aware-v1';
export interface ChunkConfig {
  size: number;
  overlap: number;
  scenarioIds: string[];
}
export function config(env: NodeJS.ProcessEnv = process.env): ChunkConfig {
  const size = Number(env.CHUNK_SIZE ?? 1600);
  const overlap = Number(env.CHUNK_OVERLAP ?? 200);
  if (
    !Number.isSafeInteger(size) ||
    size < 32 ||
    !Number.isSafeInteger(overlap) ||
    overlap < 0 ||
    overlap >= size / 2
  )
    throw new Error(
      'CHUNK_SIZE must be an integer >= 32; CHUNK_OVERLAP must be >= 0 and less than half the size.',
    );
  return {
    size,
    overlap,
    scenarioIds: [
      ...new Set(
        (env.KNOWLEDGE_SCENARIO_IDS ?? '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].sort(),
  };
}
export function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((s) => s.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
export function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export interface Span {
  content: string;
  start: number;
  end: number;
}
export function splitText(raw: string, cfg: ChunkConfig): Span[] {
  // Validate direct callers as well as CLI configuration.
  config({ CHUNK_SIZE: String(cfg.size), CHUNK_OVERLAP: String(cfg.overlap) });
  const text = normalize(raw);
  const groups = [
    /\n\s*\n|\n(?=\s*(?:[-*+] |\d+[.)] ))/g,
    /[.!?](?:["')\]]*)\s+/g,
    /\s+/g,
  ];
  const boundaries = groups.map((re) =>
    [...text.matchAll(re)].map((m) => m.index! + m[0].length),
  );
  const chunks: Span[] = [];
  let start = 0;
  while (start < text.length) {
    let end = text.length;
    if (text.length - start > cfg.size) {
      end = start + cfg.size;
      for (const ends of boundaries) {
        const candidates = ends.filter(
          (p) => p > start + cfg.size / 2 && p <= start + cfg.size,
        );
        if (candidates.length) {
          end = candidates.at(-1)!;
          break;
        }
      }
      // Absorb a tiny tail rather than emitting a fragment. Size is a soft target.
      if (text.length - end < cfg.size * 0.15) end = text.length;
    }
    let trimmedEnd = end;
    while (trimmedEnd > start && /\s/.test(text[trimmedEnd - 1])) trimmedEnd--;
    chunks.push({
      content: text.slice(start, trimmedEnd),
      start,
      end: trimmedEnd,
    });
    if (end === text.length) break;
    let next = end;
    if (cfg.overlap) {
      for (const ends of boundaries) {
        const candidate = ends.find(
          (p) => p >= end - cfg.overlap && p > start && p < trimmedEnd,
        );
        if (candidate !== undefined) {
          next = candidate;
          break;
        }
      }
    }
    while (next < text.length && /\s/.test(text[next])) next++;
    start = next;
  }
  return chunks;
}
