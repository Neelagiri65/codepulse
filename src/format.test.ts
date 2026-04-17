import { describe, expect, it } from 'vitest';
import {
  bucketForScore,
  distribution,
  formatRelativeTime,
  formatStars,
  healthToken,
} from './format';

describe('formatStars', () => {
  it('renders <1000 as integer', () => {
    expect(formatStars(0)).toBe('0');
    expect(formatStars(7)).toBe('7');
    expect(formatStars(999)).toBe('999');
  });

  it('renders thousands with a single decimal', () => {
    expect(formatStars(1000)).toBe('1.0k');
    expect(formatStars(1234)).toBe('1.2k');
    expect(formatStars(17031)).toBe('17.0k');
    expect(formatStars(43573)).toBe('43.6k');
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-04-17T00:00:00Z');

  it('returns "today" for same day', () => {
    expect(formatRelativeTime('2026-04-17T10:00:00Z', now)).toBe('today');
  });

  it('returns days for <7 days', () => {
    expect(formatRelativeTime('2026-04-13T00:00:00Z', now)).toBe('4d ago');
  });

  it('returns weeks for <30 days', () => {
    expect(formatRelativeTime('2026-04-01T00:00:00Z', now)).toBe('2w ago');
  });

  it('returns months for <365 days', () => {
    expect(formatRelativeTime('2026-01-01T00:00:00Z', now)).toBe('3mo ago');
  });

  it('returns years for ≥365 days', () => {
    expect(formatRelativeTime('2024-04-17T00:00:00Z', now)).toBe('2y ago');
  });
});

describe('bucketForScore', () => {
  it('maps scores to the 5 health buckets', () => {
    expect(bucketForScore(0)).toBe(0);
    expect(bucketForScore(5)).toBe(0);
    expect(bucketForScore(6)).toBe(1);
    expect(bucketForScore(20)).toBe(1);
    expect(bucketForScore(21)).toBe(2);
    expect(bucketForScore(40)).toBe(2);
    expect(bucketForScore(41)).toBe(3);
    expect(bucketForScore(65)).toBe(3);
    expect(bucketForScore(66)).toBe(4);
    expect(bucketForScore(100)).toBe(4);
  });
});

describe('healthToken', () => {
  it('returns the health CSS variable for a bucket', () => {
    expect(healthToken(0)).toBe('var(--health-0)');
    expect(healthToken(4)).toBe('var(--health-4)');
  });
});

describe('distribution', () => {
  it('counts scores into the five leaderboard buckets', () => {
    const scores = [0, 0, 0, 8, 30, 45, 90];
    expect(distribution(scores)).toEqual({
      buckets: [
        { label: '0', range: [0, 0], count: 3 },
        { label: '1–25', range: [1, 25], count: 1 },
        { label: '26–50', range: [26, 50], count: 2 },
        { label: '51–75', range: [51, 75], count: 0 },
        { label: '76–100', range: [76, 100], count: 1 },
      ],
      total: 7,
      clean: 3,
      cleanPct: 43,
      max: 90,
      median: 8,
    });
  });

  it('handles an empty list', () => {
    const d = distribution([]);
    expect(d.total).toBe(0);
    expect(d.cleanPct).toBe(0);
    expect(d.max).toBe(0);
    expect(d.median).toBe(0);
  });
});
