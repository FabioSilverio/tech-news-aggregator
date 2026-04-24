import { FEED_LIMITS, RSS_FEEDS } from "./feedConfig";
import { fetchHackerNews, fetchRssFeed, fetchSubreddit } from "./fetchers";
import { loadSourceSafe } from "./resilient";
import type { AggregatedItem } from "./types";

/**
 * Carrega todas as fontes em paralelo, **isoladas**: falha de uma não anula as outras
 * (cada uma devolve `[]` em caso de erro).
 */
export async function loadAllFeeds() {
  const [hn, rdTech, rdSing, verge, tc] = await Promise.all([
    loadSourceSafe<AggregatedItem>("Hacker News", () => fetchHackerNews(FEED_LIMITS.hackerNews)),
    loadSourceSafe<AggregatedItem>("r/technews", () => fetchSubreddit("technews", FEED_LIMITS.redditPerSub)),
    loadSourceSafe<AggregatedItem>("r/singularity", () => fetchSubreddit("singularity", FEED_LIMITS.redditPerSub)),
    loadSourceSafe<AggregatedItem>("The Verge", () =>
      fetchRssFeed(RSS_FEEDS[0].url, RSS_FEEDS[0].label, FEED_LIMITS.rssPerFeed),
    ),
    loadSourceSafe<AggregatedItem>("TechCrunch", () =>
      fetchRssFeed(RSS_FEEDS[1].url, RSS_FEEDS[1].label, FEED_LIMITS.rssPerFeed),
    ),
  ]);

  return { hn, rdTech, rdSing, verge, tc };
}
