import { FeedShell } from "@/components/FeedShell";
import { fetchHackerNews, fetchRssFeed, fetchSubreddit } from "@/lib/fetchers";
import { chronological, computeHomeRanking } from "@/lib/ranking";

export const revalidate = 300;

export default async function Page() {
  const [hn, rdTech, rdSing, verge, tc] = await Promise.all([
    fetchHackerNews(40),
    fetchSubreddit("technews", 22),
    fetchSubreddit("singularity", 22),
    fetchRssFeed("https://www.theverge.com/rss/index.xml", "The Verge"),
    fetchRssFeed("https://techcrunch.com/feed/", "TechCrunch"),
  ]);

  const merged = [...hn, ...rdTech, ...rdSing, ...verge, ...tc];
  const homeItems = computeHomeRanking(merged);
  const chronoItems = chronological(merged);

  return <FeedShell homeItems={homeItems} chronoItems={chronoItems} />;
}
