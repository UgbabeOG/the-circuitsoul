/**
 * CircuitSoul Blog — Trend Discovery Provider Abstraction
 *
 * Provides a provider abstraction so the application can switch between
 * trend sources without rewriting callers. Each provider implements:
 *   fetchTrends(): Promise<RawTrend[]>
 *
 * RawTrend is normalized before persistence so downstream code never
 * depends on provider-specific response shapes.
 *
 * No fabricated statistics or search-volume claims are ever produced.
 * Trends are sourced from publicly available feeds only.
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
 * Fetches trending topics from Google Trends Trending Now for a given
 * geographic region. Google does not offer an unrestricted public API
 * for Trending Now, so this provider uses the public trending searches
 * page. No search-volume values are ever fabricated or reported.
 */
export class GoogleTrendsProvider implements TrendProvider {
  readonly name = 'google-trends';
  private readonly geo: string;

  constructor(geo = 'NG') {
    this.geo = geo;
  }

  async fetchTrends(): Promise<RawTrend[]> {
    const url = `https://trends.google.com/trends/trendingsearches/daily?geo=${this.geo}&hl=en`;
    try {
      const response = await fetch(url, {
        headers: {
          'Accept-Language': 'en-US,en;q=0.9',
          'User-Agent': 'Mozilla/5.0 (compatible; CircuitSoulBot/1.0)'
        }
      });
      if (!response.ok) return [];
      const html = await response.text();
      return this.parseHtml(html);
    } catch {
      return [];
    }
  }

  private parseHtml(html: string): RawTrend[] {
    const trends: RawTrend[] = [];
    const now = new Date();

    // Google Trends embeds trending topics in the HTML. Extract topic titles
    // from the rendered HTML structure.
    const topicMatches = html.matchAll(/<div class="i2xODd">([^<]+)<\/div>/g);
    for (const match of topicMatches) {
      const topic = match[1].trim();
      if (topic && topic.length > 2 && topic.length < 200) {
        trends.push({
          topic,
          category: 'Technology',
          region: this.geo,
          collectedAt: now,
          externalUrl: `https://trends.google.com/trends/trendingsearches/daily?geo=${this.geo}`,
          externalId: `gt-${this.geo}-${Buffer.from(topic).toString('hex').substring(0, 12)}`,
          metadata: { source: 'google-trends', region: this.geo }
        });
      }
    }

    return trends;
  }
}

/**
 * RssTrendProvider
 *
 * Fetches and parses an RSS 2.0 feed using a lightweight string-based parser.
 * Malformed feeds are caught and logged; the provider returns an empty array
 * rather than throwing. No external XML parsing dependency is used.
 */
export class RssTrendProvider implements TrendProvider {
  readonly name: string;
  private readonly feedUrl: string;

  constructor(name: string, feedUrl: string) {
    this.name = name;
    this.feedUrl = feedUrl;
  }

  async fetchTrends(): Promise<RawTrend[]> {
    try {
      const response = await fetch(this.feedUrl, {
        headers: {
          'Accept': 'application/rss+xml, application/xml, text/xml',
          'User-Agent': 'Mozilla/5.0 (compatible; CircuitSoulBot/1.0)'
        }
      });
      if (!response.ok) return [];
      const xml = await response.text();
      return this.parseRss(xml);
    } catch {
      return [];
    }
  }

  private parseRss(xml: string): RawTrend[] {
    const trends: RawTrend[] = [];
    const now = new Date();

    try {
      // Extract all <item> blocks from the RSS feed
      const itemMatches = xml.match(/<item[\s>]*>([\s\S]*?)<\/item>/gi);
      if (!itemMatches) return trends;

      for (const itemMatch of itemMatches) {
        const title = this.extractTagContent(itemMatch, 'title');
        if (!title || title.length < 2 || title.length > 200) continue;

        const description = this.extractTagContent(itemMatch, 'description');
        const category = this.extractTagContent(itemMatch, 'category');
        const link = this.extractTagContent(itemMatch, 'link');
        const guid = this.extractTagContent(itemMatch, 'guid');
        const pubDate = this.extractTagContent(itemMatch, 'pubDate');

        trends.push({
          topic: title,
          summary: description ? description.trim() : undefined,
          category: category ? category.trim() : 'Technology',
          region: 'NG',
          collectedAt: pubDate ? new Date(pubDate.trim()) : now,
          externalUrl: link ? link.trim() : undefined,
          externalId: guid ? guid.trim() : undefined,
          metadata: { source: this.name, feedUrl: this.feedUrl }
        });
      }
    } catch {
      // Malformed XML - return empty rather than throwing
      return trends;
    }

    return trends;
  }

  private extractTagContent(xml: string, tagName: string): string | null {
    const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
    if (!match) return null;
    return match[1].replace(/<[^>]*>/g, '').trim();
  }
}

export function createDefaultProviders(): TrendProvider[] {
  const providers: TrendProvider[] = [new GoogleTrendsProvider('NG')];

  const rssFeeds = (process.env.BLOG_RSS_FEEDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  rssFeeds.forEach((url, index) => {
    providers.push(new RssTrendProvider(`rss-${index}`, url));
  });

  return providers;
}
