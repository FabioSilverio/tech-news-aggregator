export type FeedSource = "hackernews" | "reddit" | "rss";

export interface AggregatedItem {
  id: string;
  source: FeedSource;
  sourceLabel: string;
  title: string;
  url: string;
  domain: string;
  author?: string;
  score: number;
  comments: number;
  createdAt: number;
  thumbnail?: string;
  rankScore: number;
}
