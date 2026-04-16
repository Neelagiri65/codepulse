import { describe, it, expect } from 'vitest';
import { validateCatalogue, type RawCatalogue } from './validate-catalogue';

const base = {
  version: 1,
  updated_at: '2026-04-16',
  patterns: [],
};

const entry = (over: Partial<Record<string, unknown>> = {}): Record<string, unknown> => ({
  id: 'test-1',
  match_type: 'phrase',
  match_value: 'foo',
  weight: 5,
  source_url: 'https://example.test/doc',
  reason: 'test entry',
  added_at: '2026-04-16',
  claude_code_version_verified_against: '2026-04-16',
  ...over,
});

const cat = (patterns: unknown[]): RawCatalogue =>
  ({ ...base, patterns }) as unknown as RawCatalogue;

describe('validateCatalogue()', () => {
  it('passes an empty catalogue', () => {
    const result = validateCatalogue(cat([]));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('passes a single well-formed entry', () => {
    const result = validateCatalogue(cat([entry()]));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails when id is missing', () => {
    const result = validateCatalogue(cat([entry({ id: undefined })]));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/id/);
  });

  it('fails on duplicate ids', () => {
    const result = validateCatalogue(cat([entry({ id: 'dup' }), entry({ id: 'dup' })]));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/duplicate/i);
  });

  it('fails when match_type is not phrase|regex', () => {
    const result = validateCatalogue(cat([entry({ match_type: 'substring' })]));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/match_type/);
  });

  it('fails when match_value is empty', () => {
    const result = validateCatalogue(cat([entry({ match_value: '' })]));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/match_value/);
  });

  it('fails when weight is below 1', () => {
    const result = validateCatalogue(cat([entry({ weight: 0 })]));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/weight/);
  });

  it('fails when weight is above 10', () => {
    const result = validateCatalogue(cat([entry({ weight: 11 })]));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/weight/);
  });

  it('fails when source_url is empty', () => {
    const result = validateCatalogue(cat([entry({ source_url: '' })]));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/source_url/);
  });

  it('fails when source_url is not http/https', () => {
    const result = validateCatalogue(cat([entry({ source_url: 'not-a-url' })]));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/source_url/);
  });

  it('fails when reason is empty', () => {
    const result = validateCatalogue(cat([entry({ reason: '' })]));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/reason/);
  });

  it('fails when added_at is not ISO-ish', () => {
    const result = validateCatalogue(cat([entry({ added_at: 'yesterday' })]));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/added_at/);
  });

  it('fails when claude_code_version_verified_against is missing', () => {
    const result = validateCatalogue(
      cat([entry({ claude_code_version_verified_against: undefined })]),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/claude_code_version_verified_against/);
  });

  it('fails when claude_code_version_verified_against is not ISO-ish', () => {
    const result = validateCatalogue(
      cat([entry({ claude_code_version_verified_against: 'last week' })]),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/claude_code_version_verified_against/);
  });

  it('accepts a valid ISO claude_code_version_verified_against', () => {
    const result = validateCatalogue(
      cat([entry({ claude_code_version_verified_against: '2026-04-17' })]),
    );
    expect(result.ok).toBe(true);
  });

  it('fails when a regex match_value is not compilable', () => {
    const result = validateCatalogue(
      cat([entry({ match_type: 'regex', match_value: '[unterminated' })]),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/regex/i);
  });

  it('accepts a compilable regex entry', () => {
    const result = validateCatalogue(
      cat([entry({ match_type: 'regex', match_value: '\\bfoo\\b' })]),
    );
    expect(result.ok).toBe(true);
  });

  it('aggregates errors across multiple bad entries', () => {
    const result = validateCatalogue(
      cat([
        entry({ id: 'a', weight: 0 }),
        entry({ id: 'a', source_url: '' }), // duplicate id AND empty source_url
      ]),
    );
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects a catalogue whose top-level shape is wrong', () => {
    const result = validateCatalogue({ whatever: true } as unknown as RawCatalogue);
    expect(result.ok).toBe(false);
  });
});
