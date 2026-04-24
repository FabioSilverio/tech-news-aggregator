import { FeedShell } from "@/components/FeedShell";
import { FEED_LIMITS, RSS_FEEDS } from "@/lib/feedConfig";
import { fetchHackerNews, fetchRssFeed, fetchSubreddit } from "@/lib/fetchers";
import { enrichItemsWithOgImages } from "@/lib/ogImage";
import { chronological, computeHomeRanking } from "@/lib/ranking";

export const revalidate = 300;

export default async function Page() {
  const [hn, rdTech, rdSing, verge, tc] = await Promise.all([
    fetchHackerNews(FEED_LIMITS.hackerNews),
    fetchSubreddit("technews", FEED_LIMITS.redditPerSub),
    fetchSubreddit("singularity", FEED_LIMITS.redditPerSub),
    fetchRssFeed(RSS_FEEDS[0].url, RSS_FEEDS[0].label, FEED_LIMITS.rssPerFeed),
    fetchRssFeed(RSS_FEEDS[1].url, RSS_FEEDS[1].label, FEED_LIMITS.rssPerFeed),
  ]);

  const raw = [...hn, ...rdTech, ...rdSing, ...verge, ...tc];
  const merged = await enrichItemsWithOgImages(raw);
  const homeItems = computeHomeRanking(merged);
  const chronoItems = chronological(merged);

  return <FeedShell homeItems={homeItems} chronoItems={chronoItems} />;
}
