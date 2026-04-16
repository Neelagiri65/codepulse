import { describe, it, expect } from 'vitest';
import { score, type Pattern } from './score';

const pat = (
  id: string,
  match_type: 'phrase' | 'regex',
  match_value: string,
  weight = 5,
): Pattern => ({
  id,
  match_type,
  match_value,
  weight,
  source_url: 'https://example.test/pattern',
  reason: 'test fixture',
  added_at: '2026-04-16',
});

describe('score() — fixture: empty input', () => {
  const catalogue: Pattern[] = [pat('a', 'phrase', 'foo'), pat('b', 'phrase', 'bar')];

  it('returns zero score with empty content', () => {
    const card = score('', catalogue);
    expect(card.redundancyScore).toBe(0);
    expect(card.matches).toEqual([]);
    expect(card.tokenCost).toBe(0);
    expect(card.skipped).toEqual([]);
  });
});

describe('score() — fixture: single-match input', () => {
  const catalogue: Pattern[] = [
    pat('a', 'phrase', 'foo', 3),
    pat('b', 'phrase', 'bar', 7),
  ];

  it('scores weighted ratio of matched / total catalogue weight', () => {
    const card = score('hello foo world', catalogue);
    expect(card.redundancyScore).toBe(30); // 3 / (3+7) * 100
    expect(card.matches).toHaveLength(1);
    expect(card.matches[0].patternId).toBe('a');
    expect(card.matches[0].weight).toBe(3);
    expect(card.matches[0].excerpt).toContain('foo');
  });

  it('counts each matched pattern exactly once, not per occurrence', () => {
    const card = score('foo foo foo foo', [pat('a', 'phrase', 'foo', 5)]);
    expect(card.matches).toHaveLength(1);
    expect(card.redundancyScore).toBe(100);
  });
});

describe('score() — fixture: all-catalogue-match input', () => {
  const catalogue: Pattern[] = [
    pat('a', 'phrase', 'foo', 4),
    pat('b', 'phrase', 'bar', 6),
    pat('c', 'regex', 'baz+', 10),
  ];

  it('returns redundancyScore 100 when every pattern matches', () => {
    const card = score('foo and bar with bazzz', catalogue);
    expect(card.redundancyScore).toBe(100);
    expect(card.matches).toHaveLength(3);
    const ids = card.matches.map((m) => m.patternId).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
  });
});

describe('score() — fixture: no-match input', () => {
  const catalogue: Pattern[] = [
    pat('a', 'phrase', 'foo'),
    pat('b', 'regex', 'bar\\d+'),
  ];

  it('returns zero score and empty matches when nothing hits', () => {
    const card = score('entirely unrelated prose', catalogue);
    expect(card.redundancyScore).toBe(0);
    expect(card.matches).toEqual([]);
  });
});

describe('score() — edge behaviour', () => {
  it('handles empty catalogue without dividing by zero', () => {
    const card = score('anything at all', []);
    expect(card.redundancyScore).toBe(0);
    expect(card.matches).toEqual([]);
    expect(card.tokenCost).toBeGreaterThan(0);
  });

  it('tokenCost is Math.ceil(content.length / 4)', () => {
    expect(score('abcd', []).tokenCost).toBe(1);
    expect(score('abcde', []).tokenCost).toBe(2);
    expect(score('a'.repeat(400), []).tokenCost).toBe(100);
  });

  it('matches are case-sensitive for phrases', () => {
    const card = score('FOO', [pat('a', 'phrase', 'foo')]);
    expect(card.matches).toEqual([]);
    expect(card.redundancyScore).toBe(0);
  });

  it('supports regex match_type', () => {
    const card = score('version 1.2.3 shipped', [pat('v', 'regex', '\\d+\\.\\d+\\.\\d+', 5)]);
    expect(card.matches).toHaveLength(1);
    expect(card.matches[0].patternId).toBe('v');
  });

  it('skips invalid regex entries rather than throwing', () => {
    const catalogue: Pattern[] = [
      pat('broken', 'regex', '[unterminated', 5),
      pat('good', 'phrase', 'hit', 5),
    ];
    const card = score('this is a hit', catalogue);
    expect(card.skipped).toContain('broken');
    expect(card.matches.map((m) => m.patternId)).toEqual(['good']);
    // denominator still includes the skipped pattern's weight → conservative
    expect(card.redundancyScore).toBe(50); // 5 / (5+5) * 100
  });

  it('produces a short excerpt around the first match', () => {
    const longPrefix = 'x'.repeat(200);
    const content = `${longPrefix}TARGET${longPrefix}`;
    const card = score(content, [pat('t', 'phrase', 'TARGET', 5)]);
    expect(card.matches[0].excerpt).toContain('TARGET');
    expect(card.matches[0].excerpt.length).toBeLessThan(content.length);
  });

  it('is deterministic: same input → same output', () => {
    const cat: Pattern[] = [pat('a', 'phrase', 'x', 3), pat('b', 'regex', 'y+', 7)];
    const a = score('x yyy', cat);
    const b = score('x yyy', cat);
    expect(a).toEqual(b);
  });

  it('rounds the redundancy score to an integer 0–100', () => {
    const cat: Pattern[] = [
      pat('a', 'phrase', 'x', 1),
      pat('b', 'phrase', 'y', 1),
      pat('c', 'phrase', 'z', 1),
    ];
    const card = score('x', cat); // 1/3 * 100 = 33.33...
    expect(card.redundancyScore).toBe(33);
    expect(Number.isInteger(card.redundancyScore)).toBe(true);
  });
});
