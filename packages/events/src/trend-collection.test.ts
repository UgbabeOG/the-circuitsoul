/**
 * CircuitSoul Blog — Trend Collection Tests
 * Verifies scoring, dedup, and provider ingestion behavior.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scoreTrend } from './trend-collection';

describe('Trend scoring', () => {
  it('scores Nigeria-focused AI topics higher than generic topics', () => {
    const nigeriaAi = scoreTrend({ topic: 'AI regulation in Nigeria', category: 'Technology', region: 'Nigeria' });
    const generic = scoreTrend({ topic: 'Generic tech news', category: 'Technology', region: 'Global' });
    assert.ok(nigeriaAi > generic);
  });

  it('caps score at 100', () => {
    const maxed = scoreTrend({
      topic: 'AI regulation in Nigeria',
      category: 'Cybersecurity',
      region: 'Nigeria',
      summary: 'AI cybersecurity regulation Nigeria startups fintech'
    });
    assert.ok(maxed <= 100);
    assert.ok(maxed > 80);
  });

  it('gives baseline score to any collected topic', () => {
    const low = scoreTrend({ topic: 'Unrelated topic', category: 'Other', region: 'Europe' });
    assert.ok(low >= 40);
  });
});

describe('Trend provider interface', () => {
  it('GoogleTrendsProvider name is google-trends', () => {
    const { GoogleTrendsProvider } = require('@circuitsoul/api-adapters');
    const p = new GoogleTrendsProvider();
    assert.strictEqual(p.name, 'google-trends');
  });
});
