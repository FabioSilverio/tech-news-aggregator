import { STOPWORDS } from "./stopwords";

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

export function buildTrendVocabulary(titles: string[], maxTerms = 80): Set<string> {
  const freq = new Map<string, number>();
  for (const title of titles) {
    for (const t of tokenize(title)) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, maxTerms);
  return new Set(sorted.map(([w]) => w));
}

export function overlapScore(title: string, vocab: Set<string>): number {
  if (vocab.size === 0) return 0;
  const words = new Set(tokenize(title));
  if (words.size === 0) return 0;
  let hit = 0;
  for (const w of words) {
    if (vocab.has(w)) hit++;
  }
  const ratio = hit / words.size;
  return Math.min(1, ratio * 1.25);
}
