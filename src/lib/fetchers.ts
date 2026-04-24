import Parser from "rss-parser";
import type { AggregatedItem } from "./types";

const UA =
  "Mozilla/5.0 (compatible; TechNewsAggregator/1.0; +https://github.com/tech-news-aggregator)";

function domainFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        ...(init?.headers as Record<string, string>),
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchHackerNews(limit = 35): Promise<AggregatedItem[]> {
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
}

export async function fetchSubreddit(name: string, limit = 20): Promise<AggregatedItem[]> {
  const data = await fetchJson<RedditListing>(
    `https://www.reddit.com/r/${name}/hot.json?limit=${limit}`,
    { headers: { "User-Agent": UA } },
  );
  const children = data?.data?.children ?? [];
  const out: AggregatedItem[] = [];
  for (const { data: p } of children) {
    if (!p?.title || p.stickied) continue;
    const url = p.url?.startsWith("http")
      ? p.url
      : `https://www.reddit.com${p.permalink}`;
    let thumb = p.thumbnail;
    if (
      !thumb ||
      thumb === "self" ||
      thumb === "default" ||
      thumb === "nsfw" ||
      thumb === "image"
    ) {
      thumb = undefined;
    }
    const ups = typeof p.ups === "number" ? p.ups : p.score ?? 0;
    out.push({
      id: `rd-${name}-${p.id}`,
      source: "reddit",
      sourceLabel: `r/${name}`,
      title: p.title,
      url,
      domain: p.domain ?? domainFromUrl(url),
      author: p.author,
      score: ups,
      comments: p.num_comments ?? 0,
      createdAt: p.created_utc * 1000,
      thumbnail: thumb,
      rankScore: 0,
    });
  }
  return out;
}

const parser = new Parser({
  headers: { "User-Agent": UA },
  timeout: 12000,
});

export async function fetchRssFeed(
  feedUrl: string,
  sourceLabel: string,
): Promise<AggregatedItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    const out: AggregatedItem[] = [];
    let i = 0;
    for (const item of feed.items ?? []) {
      if (!item.title || !item.link) continue;
      const created =
        (item.pubDate ? new Date(item.pubDate).getTime() : Date.now()) || Date.now();
      const media =
        (item as { enclosure?: { url?: string } }).enclosure?.url ||
        (item as { "media:content"?: { $?: { url?: string } } })["media:content"]?.$?.url;
      const content = item.contentSnippet ?? item.content ?? "";
      const imgMatch = content.match(/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/i);
      out.push({
        id: `rss-${sourceLabel}-${i++}-${created}`,
        source: "rss",
        sourceLabel,
        title: item.title.trim(),
        url: item.link,
        domain: domainFromUrl(item.link),
        author: item.creator ?? item.author,
        score: 0,
        comments: 0,
        createdAt: created,
        thumbnail: media || imgMatch?.[0],
        rankScore: 0,
      });
    }
    return out;
  } catch {
    return [];
  }
}
