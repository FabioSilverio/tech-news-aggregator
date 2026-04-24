import { FeedShell } from "@/components/FeedShell";
import { enrichItemsWithOgImages } from "@/lib/ogImage";
import { loadAllFeeds } from "@/lib/loadAllFeeds";
import { chronological, computeHomeRanking } from "@/lib/ranking";

/** Destaques + cronológico: 30 min — manter = `feedConfig.PAGE_REVALIDATE_SEC` / `DATA_FETCH_REVALIDATE_SEC` */
export const revalidate = 1800;
/** Fetches + og:image: margem além do 10s default da Vercel, se o plano permitir `maxDuration`. */
export const maxDuration = 60;

export default async function Page() {
  const { hn, rdTech, rdSing, verge, tc } = await loadAllFeeds();

  const raw = [...hn, ...rdTech, ...rdSing, ...verge, ...tc];
  const merged = await enrichItemsWithOgImages(raw);
  const homeItems = computeHomeRanking(merged);
  const chronoItems = chronological(merged);

  return <FeedShell homeItems={homeItems} chronoItems={chronoItems} />;
}
