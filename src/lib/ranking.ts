import type { AggregatedItem } from "./types";
import { buildTrendVocabulary, overlapScore } from "./tokens";

function maxLog1p(values: number[]): number {
  const m = Math.max(0, ...values.map((v) => Math.log1p(Math.max(0, v))));
  return m > 0 ? m : 1;
}

function recencyFactor(createdAt: number, halfLifeMs: number): number {
  const age = Date.now() - createdAt;
  return Math.exp(-Math.max(0, age) / halfLifeMs);
}

/**
 * Home ranking: HN/Reddit popularity (log-normalized) + freshness;
 * RSS (Verge, TechCrunch) boosted by lexical overlap with trending HN+Reddit titles.
 */
export function computeHomeRanking(items: AggregatedItem[]): AggregatedItem[] {
  const hnReddit = items.filter((i) => i.source !== "rss");
  const rss = items.filter((i) => i.source === "rss");

  const trendTitles = hnReddit.slice(0, 60).map((i) => i.title);
  const vocab = buildTrendVocabulary(trendTitles, 100);

  const scores = hnReddit.map((i) => i.score);
  const maxPop = maxLog1p(scores);

  const halfLifePopular = 36 * 60 * 60 * 1000;
  const halfLifeRss = 18 * 60 * 60 * 1000;

  const scored: AggregatedItem[] = items.map((item) => {
    let base: number;
    if (item.source === "rss") {
      const sim = overlapScore(item.title, vocab);
      const freshness = recencyFactor(item.createdAt, halfLifeRss);
      base = 0.55 * sim + 0.45 * freshness;
    } else {
      const pop = Math.log1p(Math.max(0, item.score)) / maxPop;
      const freshness = recencyFactor(item.createdAt, halfLifePopular);
      base = 0.72 * pop + 0.28 * freshness;
    }
    return { ...item, rankScore: base };
  });

  return scored.sort((a, b) => b.rankScore - a.rankScore);
}

export function chronological(items: AggregatedItem[]): AggregatedItem[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}
