/**
 * Parâmetros de agregação e de rankeamento (aba Destaques).
 * Todos ajustáveis; somas por tipo ≈ 1.0.
 */
export const FEED_LIMITS = {
  hackerNews: 40,
  redditPerSub: 24,
  rssPerFeed: 40,
} as const;

export const RANKING = {
  /** Peso de votos/pontos (log1p, normalizados) — HN + Reddit juntos. */
  weightPopularity: 0.58,
  /** Peso de comentários (engajamento; HN/Reddit apenas). */
  weightComments: 0.12,
  /** Peso de recência (meia-vida abaixo). */
  weightFreshness: 0.3,
  /**
   * RSS: similaridade de tópicos com títulos em alta (HN + Reddit) +
   * recência, sem “upvotes” nativos.
   */
  rss: {
    weightTopicSimilarity: 0.55,
    weightRecency: 0.4,
    /** Piso mínimo para ainda mostrar notícia RSS fora de tendência (0–0.1). */
    baseDiscoverability: 0.05,
  },
  /** Meia-vida (ms) para o decaimento temporal — fontes com votos. */
  halfLifeWithVotes: 40 * 60 * 60 * 1000,
  /** Meia-vida (ms) para itens RSS. */
  halfLifeRss: 20 * 60 * 60 * 1000,
} as const;

export const RSS_FEEDS = [
  { label: "The Verge" as const, url: "https://www.theverge.com/rss/index.xml" },
  { label: "TechCrunch" as const, url: "https://techcrunch.com/feed/" },
] as const;

export const SUBREDDITS = ["technews", "singularity"] as const;

/**
 * Na aba Destaques, após calcular `rankScore` por fonte, a lista final intercala
 * 1 HN : 1 Reddit : 1 RSS (nessa ordem) para ninguém monopolizar o topo com um único
 * sinal (ex.: só pontos do HN). O cronológico continua puro por data.
 */
export const HOME_INTERLEAVE_HN_REDDIT_RSS = true;

/**
 * Busca `og:image` / `twitter:image` no HTML do artigo (HN sem thumb, links externos, etc.).
 * Limites agressivos para caber no tempo de função serverless (Vercel).
 */
export const IMAGE_OG = {
  /** Quantas URLs distintas tentar buscar (artigos ainda sem thumb). */
  maxDistinctUrls: 16,
  /** Buscas em paralelo. */
  concurrency: 4,
  /** Timeout por fetch do HTML. */
  timeoutMs: 3000,
  /** Só o começo do HTML (bytes aprox. via slice em chars) para achar as meta tags. */
  headChars: 180_000,
} as const;

/** Reddit exige User-Agent de navegador; APIs genéricas retornam 403 em muitos hosts. */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
