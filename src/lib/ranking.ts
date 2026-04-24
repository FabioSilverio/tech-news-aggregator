import { HOME_INTERLEAVE_HN_REDDIT_RSS, RANKING } from "./feedConfig";
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

  const trendTitles = hnReddit.slice(0, 60).map((i) => i.title);
  const vocab = buildTrendVocabulary(trendTitles, 100);

  const scores = hnReddit.map((i) => i.score);
  const maxPop = maxLog1p(scores);

  const halfLifePopular = RANKING.halfLifeWithVotes;
  const halfLifeRss = RANKING.halfLifeRss;

  const comments = hnReddit.map((i) => i.comments);
  const maxCom = maxLog1p(comments);

  const scored: AggregatedItem[] = items.map((item) => {
    let base: number;
    if (item.source === "rss") {
      const sim = overlapScore(item.title, vocab);
      const freshness = recencyFactor(item.createdAt, halfLifeRss);
      const w = RANKING.rss;
      base =
        w.weightTopicSimilarity * sim +
        w.weightRecency * freshness +
        w.baseDiscoverability;
    } else {
      const pop = Math.log1p(Math.max(0, item.score)) / maxPop;
      const comN = maxCom > 0 ? Math.log1p(Math.max(0, item.comments)) / maxCom : 0;
      const freshness = recencyFactor(item.createdAt, halfLifePopular);
      base =
        RANKING.weightPopularity * pop +
        RANKING.weightComments * comN +
        RANKING.weightFreshness * freshness;
    }
    return { ...item, rankScore: base };
  });

  if (!HOME_INTERLEAVE_HN_REDDIT_RSS) {
    return scored.sort((a, b) => b.rankScore - a.rankScore);
  }

  return interleaveHomeBySource(scored);
}

function interleaveHomeBySource(scored: AggregatedItem[]): AggregatedItem[] {
  const byScore = (a: AggregatedItem, b: AggregatedItem) => b.rankScore - a.rankScore;
  const hn = scored.filter((i) => i.source === "hackernews").sort(byScore);
  const rd = scored.filter((i) => i.source === "reddit").sort(byScore);
  const rss = scored.filter((i) => i.source === "rss").sort(byScore);

  const out: AggregatedItem[] = [];
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < hn.length || j < rd.length || k < rss.length) {
    if (i < hn.length) out.push(hn[i++]!);
    if (j < rd.length) out.push(rd[j++]!);
    if (k < rss.length) out.push(rss[k++]!);
  }
  return out;
}

export function chronological(items: AggregatedItem[]): AggregatedItem[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}
