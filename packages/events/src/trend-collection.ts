/**
 * CircuitSoul Blog — Trend Collection Service
 *
 * Collects trends from configured providers, normalizes them, deduplicates,
 * scores relevance for CircuitSoul's African SME audience, and persists
 * results to the database. No fabricated statistics are ever written.
 */

import { PrismaClient } from '@prisma/client';
import { TrendProvider, RawTrend } from '@circuitsoul/api-adapters';

const prisma = new PrismaClient();

export interface CollectedTrendResult {
  trendId: string;
  topic: string;
  source: string;
  combinedScore: number;
  isNew: boolean;
}

const SCORING_CATEGORIES = [
  'Cybersecurity',
  'Data Protection',
  'AI',
  'Generative AI',
  'African Startups',
  'SMEs',
  'Fintech',
  'Digital Payments',
  'Cloud Infrastructure',
  'DevOps',
  'Software Engineering',
  'Technology Policy',
  'Regulation',
  'NDPR',
  'Nigeria',
  'Africa'
];

export function scoreTrend(trend: RawTrend, regionHint?: string): number {
  const t = trend.topic.toLowerCase();
  const summary = (trend.summary || '').toLowerCase();
  const category = trend.category.toLowerCase();

  let score = 40;

  for (const cat of SCORING_CATEGORIES) {
    if (t.includes(cat.toLowerCase()) || summary.includes(cat.toLowerCase()) || category.includes(cat.toLowerCase())) {
      score += 10;
    }
  }

  const region = (trend.region || regionHint || 'Nigeria').toLowerCase();
  if (region.includes('nigeria') || region.includes('west africa') || region.includes('africa')) {
    score += 20;
  } else if (region.includes('global') || region.includes('international')) {
    score += 5;
  }

  const now = Date.now();
  const collected = trend.collectedAt ? new Date(trend.collectedAt).getTime() : now;
  const ageHours = (now - collected) / (1000 * 60 * 60);
  if (ageHours < 24) score += 20;
  else if (ageHours < 72) score += 10;

  return Math.min(100, score);
}

export async function collectTrends(
  providers: TrendProvider[],
  regionHint?: string
): Promise<CollectedTrendResult[]> {
  const results: CollectedTrendResult[] = [];

  for (const provider of providers) {
    let rawTrends: RawTrend[] = [];
    try {
      rawTrends = await provider.fetchTrends();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown provider error';
      console.error(`Trend provider ${provider.name} failed:`, message);
      continue;
    }

    for (const raw of rawTrends) {
      const score = scoreTrend(raw, regionHint);

      const existing = await prisma.collectedTrend.findFirst({
        where: { topic: raw.topic, collectedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
      });

      if (existing && score <= (existing.combinedScore || 0)) {
        continue;
      }

      const sourceUrl = raw.externalUrl || '';
      const trendSource = await prisma.trendSource.upsert({
        where: { provider_url: { provider: provider.name, url: sourceUrl } },
        update: { lastPolledAt: new Date() },
        create: { name: provider.name, provider: provider.name, url: sourceUrl, lastPolledAt: new Date() }
      });

      const trend = await prisma.collectedTrend.create({
        data: {
          topic: raw.topic,
          summary: raw.summary,
          category: raw.category || 'Technology',
          region: raw.region || regionHint || 'Nigeria',
          relevanceScore: score,
          freshnessScore: score,
          audienceValueScore: score,
          combinedScore: score,
          externalUrl: raw.externalUrl,
          externalId: raw.externalId,
          source: { connect: { id: trendSource.id } }
        }
      });

      results.push({
        trendId: trend.id,
        topic: trend.topic,
        source: provider.name,
        combinedScore: trend.combinedScore,
        isNew: true
      });
    }
  }

  results.sort((a, b) => b.combinedScore - a.combinedScore);
  return results;
}
