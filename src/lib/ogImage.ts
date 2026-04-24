import { BROWSER_USER_AGENT, IMAGE_OG } from "./feedConfig";
import type { AggregatedItem } from "./types";

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function looksLikeImageUrl(u: string): boolean {
  if (!/^https?:\/\//i.test(u)) return false;
  if (u.length < 8 || u.length > 8_000) return false;
  if (/[<>]/.test(u)) return false;
  if (/^data:/i.test(u)) return false;
  return true;
}

/**
 * Extrai melhor candidato a imagem de destaque a partir de um trecho de HTML.
 */
export function extractHeroImageFromHtmlChunk(html: string): string | undefined {
  const head = html.length > IMAGE_OG.headChars ? html.slice(0, IMAGE_OG.headChars) : html;
  const patterns: RegExp[] = [
    /property=["']og:image["'][^>]*\s+content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /name=["']twitter:image["'][^>]*\s+content=["']([^"']+)["']/i,
    /name=["']twitter:image:src["'][^>]*\s+content=["']([^"']+)["']/i,
    /property=["']twitter:image["'][^>]*\s+content=["']([^"']+)["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ];
  for (const p of patterns) {
    const m = head.match(p);
    if (m?.[1]) {
      const raw = decodeBasicEntities(m[1].trim());
      if (looksLikeImageUrl(raw)) return raw;
    }
  }
  return undefined;
}

const SKIP_OG = [
  "news.ycombinator.com",
  "reddit.com",
  "old.reddit.com",
  "www.reddit.com",
  "m.reddit.com",
  "twitter.com",
  "x.com",
] as const;

function hostOkForOg(u: string): boolean {
  try {
    const h = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
    if (SKIP_OG.some((d) => h === d || h.endsWith(`.${d}`))) return false;
    if (h.includes("ycombinator.com") && (u.includes("/item?") || u.includes("/item?id=")))
      return false;
    return true;
  } catch {
    return false;
  }
}

export function canTryOgForUrl(articleUrl: string): boolean {
  try {
    const u = new URL(articleUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return hostOkForOg(articleUrl);
  } catch {
    return false;
  }
}

async function fetchSingleOgImage(articleUrl: string): Promise<string | undefined> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), IMAGE_OG.timeoutMs);
  try {
    const res = await fetch(articleUrl, {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Referer: new URL(articleUrl).origin,
      },
      next: { revalidate: 86_400 },
      redirect: "follow",
    });
    clearTimeout(t);
    if (!res.ok) return undefined;
    const type = res.headers.get("content-type") ?? "";
    if (!/html|xhtml|xml/i.test(type) && !type.includes("text/")) {
      if (!type.includes("octet")) return undefined;
    }
    const text = await res.text();
    const head = text.length > IMAGE_OG.headChars ? text.slice(0, IMAGE_OG.headChars) : text;
    return extractHeroImageFromHtmlChunk(head);
  } catch {
    clearTimeout(t);
    return undefined;
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const q = [...items];
  const workers: Promise<void>[] = [];
  for (let c = 0; c < concurrency; c++) {
    workers.push(
      (async () => {
        while (q.length) {
          const item = q.shift();
          if (item !== undefined) await fn(item);
        }
      })(),
    );
  }
  await Promise.all(workers);
}

/**
 * Após o fetch das fontes, preenche `thumbnail` faltando via meta tags do artigo
 * (útil p.ex. Hacker News, que não tem imagem na API).
 * URLs distintas são buscadas no máximo `IMAGE_OG.maxDistinctUrls` vezes.
 */
export async function enrichItemsWithOgImages(items: AggregatedItem[]): Promise<AggregatedItem[]> {
  try {
    const needOg = new Set<string>();
    for (const it of items) {
      if (it.thumbnail) continue;
      if (canTryOgForUrl(it.url)) needOg.add(it.url);
    }
    const urls = [...needOg].slice(0, IMAGE_OG.maxDistinctUrls);
    if (urls.length === 0) return items;

    const urlToImage = new Map<string, string>();
    await runWithConcurrency(urls, IMAGE_OG.concurrency, async (u) => {
      try {
        const img = await fetchSingleOgImage(u);
        if (img) urlToImage.set(u, img);
      } catch {
        /* nunca derruba o carregamento do feed */
      }
    });

    return items.map((it) => {
      if (it.thumbnail) return it;
      const t = urlToImage.get(it.url);
      return t ? { ...it, thumbnail: t } : it;
    });
  } catch {
    return items;
  }
}
