import Parser from "rss-parser";
import { BROWSER_USER_AGENT, SUBREDDITS } from "./feedConfig";
import type { AggregatedItem } from "./types";

const JSON_UA = `${BROWSER_USER_AGENT} (TechNewsFeed/1.0; +https://github.com/vercel)`;

function domainFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function decodeRedditImageUrl(maybe: string | undefined): string | undefined {
  if (!maybe) return undefined;
  return maybe.replace(/&amp;/g, "&");
}

function pickRedditThumb(p: RedditPost): string | undefined {
  const pvw = p.preview;
  if (pvw?.images?.[0]?.resolutions?.length) {
    const r = pvw.images[0].resolutions;
    const best = r[Math.max(0, r.length - 1)];
    const u = best?.url && decodeRedditImageUrl(best.url);
    if (u) return u;
  }
  if (pvw?.images?.[0]?.source?.url) {
    return decodeRedditImageUrl(pvw.images[0].source.url);
  }
  const t = p.thumbnail;
  if (t && t !== "self" && t !== "default" && t !== "nsfw" && t !== "image" && t.startsWith("http")) {
    return t;
  }
  return undefined;
}

export interface HNStory {
  id: number;
  title: string;
  url?: string;
  score: number;
  by: string;
  time: number;
  descendants?: number;
  kids?: number[];
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": JSON_UA,
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchHackerNews(limit: number): Promise<AggregatedItem[]> {
  const ids = await fetchJson<number[]>(
    "https://hacker-news.firebaseio.com/v0/topstories.json",
  );
  if (!ids?.length) return [];
  const slice = ids.slice(0, limit);
  const stories = await Promise.all(
    slice.map((id) =>
      fetchJson<HNStory>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`),
    ),
  );
  const out: AggregatedItem[] = [];
  for (const s of stories) {
    if (!s?.title) continue;
    const url = s.url ?? `https://news.ycombinator.com/item?id=${s.id}`;
    out.push({
      id: `hn-${s.id}`,
      source: "hackernews",
      sourceLabel: "Hacker News",
      title: s.title,
      url,
      domain: domainFromUrl(url) || "news.ycombinator.com",
      author: s.by,
      score: s.score ?? 0,
      comments: s.descendants ?? (s.kids?.length ?? 0),
      createdAt: (s.time ?? 0) * 1000,
      rankScore: 0,
    });
  }
  return out;
}

interface RedditListing {
  data?: {
    children?: { data: RedditPost }[];
  };
}

interface RedditPost {
  id: string;
  title: string;
  url?: string;
  permalink: string;
  ups: number;
  score: number;
  author: string;
  created_utc: number;
  thumbnail?: string;
  num_comments: number;
  is_self?: boolean;
  domain?: string;
  stickied?: boolean;
  preview?: {
    images?: Array<{
      source?: { url?: string };
      resolutions?: Array<{ url?: string; width: number; height: number }>;
    }>;
  };
}

const redditBrowserHeaders: HeadersInit = {
  "User-Agent": BROWSER_USER_AGENT,
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.reddit.com/",
};

/**
 * API pública do Reddit: sem User-Agent de navegador, respostas 403 são comuns
 * (sobretudo em datacenters / Vercel). Tentamos `www` e `old` como espelho.
 */
async function fetchSubredditFromReddit(
  name: (typeof SUBREDDITS)[number],
  limit: number,
): Promise<RedditListing | null> {
  const path = `/r/${name}/hot.json?limit=${Math.min(100, limit)}&raw_json=1`;
  const bases = [
    "https://www.reddit.com",
    "https://old.reddit.com",
    "https://new.reddit.com",
  ] as const;

  for (const b of bases) {
    try {
      const res = await fetch(`${b}${path}`, {
        headers: redditBrowserHeaders,
        next: { revalidate: 300 },
        redirect: "follow",
      });
      if (res.ok) {
        return (await res.json()) as RedditListing;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function fetchSubreddit(
  name: (typeof SUBREDDITS)[number],
  limit: number,
): Promise<AggregatedItem[]> {
  const data = await fetchSubredditFromReddit(name, limit);
  const children = data?.data?.children ?? [];
  const out: AggregatedItem[] = [];
  for (const { data: p } of children) {
    if (!p?.title || p.stickied) continue;
    const url = p.url?.startsWith("http")
      ? p.url
      : `https://www.reddit.com${p.permalink}`;
    const ups = typeof p.ups === "number" && p.ups > 0 ? p.ups : p.score ?? 0;
    out.push({
      id: `rd-${name}-${p.id}`,
      source: "reddit",
      sourceLabel: `r/${name}`,
      title: p.title,
      url,
      domain: p.domain?.replace(/^self\./, "") || domainFromUrl(url),
      author: p.author,
      score: ups,
      comments: p.num_comments ?? 0,
      createdAt: p.created_utc * 1000,
      thumbnail: pickRedditThumb(p),
      rankScore: 0,
    });
  }
  return out;
}

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": BROWSER_USER_AGENT, Accept: "application/rss+xml, */*" },
  requestOptions: { timeout: 20000 },
});

function feedBaseLink(feed: Parser.Output<ItemLike>): string | undefined {
  const l = feed.link;
  if (typeof l === "string") return l;
  if (l && typeof l === "object" && "href" in l) return (l as { href?: string }).href;
  if (Array.isArray(l) && l[0]) {
    const f = l[0];
    if (typeof f === "string") return f;
    if (f && typeof f === "object" && "href" in f) return (f as { href: string }).href;
  }
  return undefined;
}

type ItemLike = { link?: string; id?: string };

function resolveItemUrl(link: string | undefined, base?: string): string | null {
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  if (link.startsWith("//")) return `https:${link}`;
  if (base) {
    try {
      return new URL(link, base).href;
    } catch {
      return null;
    }
  }
  return null;
}

/** Enclosure, media:thumbnail, media:content (imagem), itunes:image, depois 1.ª imagem no HTML. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickRssHeroImage(item: any, fullText: string): string | undefined {
  if (item?.enclosure?.url) {
    const t: string = item.enclosure.type ?? "";
    if (t.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif)(?:$|\?)/i.test(String(item.enclosure.url))) {
      return item.enclosure.url;
    }
  }
  const mc = item["media:content"] as
    | { $?: { url?: string; type?: string; medium?: string } }
    | Array<{ $: { url?: string; type?: string; medium?: string } }>
    | undefined;
  if (mc) {
    const m = Array.isArray(mc) ? mc[0]?.$ : (mc as { $?: { url?: string; type?: string; medium?: string } }).$;
    if (m?.url) {
      const t = m.type || m.medium || "";
      if (t.startsWith("image/") || t === "image" || t.includes("image/")) {
        return m.url;
      }
    }
  }
  const mthumb = (item["media:thumbnail"] as { $?: { url?: string } } | undefined)?.$?.url;
  if (mthumb) return mthumb;
  const itunes = item["itunes:image"];
  if (typeof itunes === "string") return itunes;
  if (itunes?.$?.href) return itunes.$.href;
  if (itunes?.$ && typeof (itunes as { $: { href: string } }).$ === "string") {
    return (itunes as unknown as { $: string }).$;
  }
  const m1 = fullText.match(
    /https?:\/\/[^\s"'<>]+\.(?:jpe?g|png|webp|gif|avif)(?:\?[^"'<>s]*)?/i,
  );
  if (m1?.[0] && !/pixel|1x1|spacer|blank\./i.test(m1[0])) {
    return m1[0];
  }
  const m2 = fullText.match(
    /(?:data-src|data-lazy|data-original)=["'](https?:\/\/[^"']+\.(?:jpe?g|png|webp|gif|avif)[^"']*)/i,
  );
  if (m2?.[1]) return m2[1].split(" ")[0];
  return undefined;
}

/**
 * `rss-parser` + `parseURL` usa Node http(s) e costuma falhar em Vercel (HTTPS / redirects).
 * Buscamos o XML com `fetch` e usamos `parseString`.
 */
export async function fetchRssFeed(
  feedUrl: string,
  sourceLabel: string,
  itemLimit = 40,
): Promise<AggregatedItem[]> {
  const fallbacks: string[] = [feedUrl];
  if (feedUrl.includes("theverge.com")) {
    fallbacks.push("https://theverge.com/rss/index.xml");
  }

  let text: string | null = null;
  for (const url of fallbacks) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": BROWSER_USER_AGENT,
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
        next: { revalidate: 300 },
        redirect: "follow",
      });
      if (res.ok) {
        text = await res.text();
        break;
      }
    } catch {
      /* next */
    }
  }
  if (!text) return [];

  try {
    const feed = await parser.parseString(text);
    const base = feedBaseLink(feed);
    const out: AggregatedItem[] = [];
    let i = 0;
    for (const item of feed.items ?? []) {
      if (out.length >= itemLimit) break;
      if (!item.title) continue;
      const raw = item.link ?? (item as { id?: string }).id;
      const link = resolveItemUrl(raw, base) ?? (typeof raw === "string" && raw.startsWith("http") ? raw : null);
      if (!link) continue;

      const created =
        (item.pubDate ? new Date(item.pubDate).getTime() : Date.now()) || Date.now();
      const content = item.contentSnippet ?? item.content ?? "";
      const thumb = pickRssHeroImage(item, content);

      out.push({
        id: `rss-${sourceLabel}-${i++}-${link.slice(-40)}`.replace(/[^\w-]/g, "-"),
        source: "rss",
        sourceLabel,
        title: item.title.trim(),
        url: link,
        domain: domainFromUrl(link),
        author: item.creator ?? item.author,
        score: 0,
        comments: 0,
        createdAt: created,
        thumbnail: thumb,
        rankScore: 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}
