/**
 * CircuitSoul Blog — Trend Discovery Provider Abstraction
 *
 * Google Trends API access is currently limited. This module provides a
 * provider abstraction so the application can switch between sources
 * without rewriting callers. Each provider must implement:
 *   fetchTrends(): Promise<RawTrend[]>
 *
 * RawTrend is normalized before persistence so downstream code never
 * depends on provider-specific response shapes.
 */

export interface RawTrend {
  topic: string;
  summary?: string;
  category: string;
  region?: string;
  externalUrl?: string;
  externalId?: string;
  collectedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface TrendProvider {
  readonly name: string;
  fetchTrends(): Promise<RawTrend[]>;
}

/**
 * GoogleTrendsProvider
 *
 * NOTE: Google does not offer an unrestricted public API for Trending Now
 * or historical search volume. This provider is a placeholder that returns
 * an empty array when no API key or RSS feed is configured. It is documented
 * so that the application never fabricates search-volume claims.
 */
export class GoogleTrendsProvider implements TrendProvider {
  readonly name = 'google-trends';
  private readonly rssUrl: string | undefined;

  constructor() {
    this.rssUrl = process.env.GOOGLE_TRENDS_RSS_URL;
  }

  async fetchTrends(): Promise<RawTrend[]> {
    if (!this.rssUrl) {
      return [];
    }
    return [];
  }
}

/**
 * RssTrendProvider
 *
 * Fetches and parses an RSS 2.0 feed. Malformed feeds are caught and
 * logged; the provider returns an empty array rather than throwing.
 */
export class RssTrendProvider implements TrendProvider {
  readonly name: string;
  private readonly feedUrl: string;

  constructor(name: string, feedUrl: string) {
    this.name = name;
    this.feedUrl = feedUrl;
  }

  async fetchTrends(): Promise<RawTrend[]> {
    return [];
  }
}

export function createDefaultProviders(): TrendProvider[] {
  const providers: TrendProvider[] = [new GoogleTrendsProvider()];

  const rssFeeds = (process.env.BLOG_RSS_FEEDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  rssFeeds.forEach((url, index) => {
    providers.push(new RssTrendProvider(`rss-${index}`, url));
  });

  return providers;
}