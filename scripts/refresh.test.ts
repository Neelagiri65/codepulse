import { describe, it, expect, vi } from 'vitest';
import type { Pattern } from '../src/score';
import {
  scoreRepo,
  shouldWrite,
  runRefresh,
  runSemanticPass,
  type ClaudeMdFile,
  type RefreshDeps,
  type RepoEntry,
  type RepoMeta,
  type ReposPayload,
  type SemanticPassDeps,
} from './refresh';
import type { SemanticResult } from './enrich';

const pat = (id: string, value: string, weight = 5): Pattern => ({
  id,
  match_type: 'phrase',
  match_value: value,
  weight,
  source_url: 'https://example.test/doc',
  reason: 'test',
  added_at: '2026-04-16',
  claude_code_version_verified_against: '2026-04-16',
});

const meta = (over: Partial<RepoMeta> = {}): RepoMeta => ({
  owner: 'acme',
  name: 'widget',
  stars: 1234,
  ...over,
});

const file = (content: string, last_commit_at = '2026-04-10T12:00:00Z'): ClaudeMdFile => ({
  content,
  last_commit_at,
  char_count: content.length,
});

describe('scoreRepo()', () => {
  it('returns a RepoEntry with score + matched pattern ids', () => {
    const catalogue: Pattern[] = [pat('a', 'be concise', 5), pat('b', 'no emojis', 5)];
    const entry = scoreRepo(meta(), file('please be concise and no emojis'), catalogue);
    expect(entry.owner).toBe('acme');
    expect(entry.name).toBe('widget');
    expect(entry.stars).toBe(1234);
    expect(entry.char_count).toBe(31);
    expect(entry.last_commit_at).toBe('2026-04-10T12:00:00Z');
    expect(entry.score).toBe(100);
    expect(entry.matches.sort()).toEqual(['a', 'b']);
  });

  it('returns score 0 and empty matches when nothing hits', () => {
    const catalogue: Pattern[] = [pat('a', 'be concise')];
    const entry = scoreRepo(meta(), file('totally unrelated file content'), catalogue);
    expect(entry.score).toBe(0);
    expect(entry.matches).toEqual([]);
  });
});

describe('shouldWrite()', () => {
  const entry = (owner: string, score: number, matches: string[] = []): RepoEntry => ({
    owner,
    name: 'r',
    stars: 1,
    char_count: 100,
    score,
    last_commit_at: '2026-04-10T12:00:00Z',
    matches,
  });

  it('returns true on first run (prev is null)', () => {
    expect(shouldWrite(null, [entry('a', 50)])).toBe(true);
  });

  it('returns false when next equals prev (ignoring refreshed_at)', () => {
    const prev = [entry('a', 50), entry('b', 30)];
    const next = [entry('a', 50), entry('b', 30)];
    expect(shouldWrite(prev, next)).toBe(false);
  });

  it('returns true when any score changes', () => {
    const prev = [entry('a', 50)];
    const next = [entry('a', 55)];
    expect(shouldWrite(prev, next)).toBe(true);
  });

  it('returns true when matches change', () => {
    const prev = [entry('a', 50, ['x'])];
    const next = [entry('a', 50, ['x', 'y'])];
    expect(shouldWrite(prev, next)).toBe(true);
  });

  it('returns true when repo set changes (add/remove)', () => {
    const prev = [entry('a', 50)];
    const next = [entry('a', 50), entry('b', 30)];
    expect(shouldWrite(prev, next)).toBe(true);
  });

  it('returns true when repo order changes', () => {
    const prev = [entry('a', 50), entry('b', 30)];
    const next = [entry('b', 30), entry('a', 50)];
    expect(shouldWrite(prev, next)).toBe(true);
  });
});

describe('runRefresh()', () => {
  const catalogue: Pattern[] = [pat('a', 'be concise', 5), pat('b', 'no emojis', 5)];

  const buildDeps = (over: Partial<RefreshDeps> = {}): RefreshDeps => ({
    discoverTopRepos: vi.fn().mockResolvedValue([
      meta({ owner: 'one', stars: 1000 }),
      meta({ owner: 'two', stars: 900 }),
    ]),
    fetchClaudeMd: vi.fn(async (owner: string) => file(`${owner}: be concise`)),
    readCatalogue: () => catalogue,
    readExistingRepos: () => null,
    writeRepos: vi.fn(),
    writeMeta: vi.fn(),
    now: () => new Date('2026-04-17T00:00:00Z'),
    toolVersion: '0.1.0',
    catalogueVersion: 2,
    ...over,
  });

  it('writes repos.json and meta.json on first run', async () => {
    const deps = buildDeps();
    const result = await runRefresh(deps, 200);

    expect(result.wrote).toBe(true);
    expect(result.count).toBe(2);
    expect(result.skipped).toBe(0);
    expect(deps.writeRepos).toHaveBeenCalledTimes(1);
    expect(deps.writeMeta).toHaveBeenCalledTimes(1);

    const repoPayload = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(repoPayload.refreshed_at).toBe('2026-04-17T00:00:00.000Z');
    expect(repoPayload.repos).toHaveLength(2);
    expect(repoPayload.repos[0].owner).toBeDefined();

    const metaPayload = (deps.writeMeta as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(metaPayload).toEqual({
      tool_version: '0.1.0',
      catalogue_version: 2,
      last_refresh_at: '2026-04-17T00:00:00.000Z',
    });
  });

  it('skips a repo whose CLAUDE.md fetch returns null (404 / renamed)', async () => {
    const deps = buildDeps({
      fetchClaudeMd: vi.fn(async (owner: string) =>
        owner === 'two' ? null : file('be concise'),
      ),
    });
    const result = await runRefresh(deps, 200);

    expect(result.count).toBe(1);
    expect(result.skipped).toBe(1);
    const payload = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.repos).toHaveLength(1);
    expect(payload.repos[0].owner).toBe('one');
  });

  it('does not write when computed repos equal previous', async () => {
    // First compute what the run would produce, then feed it back as prev.
    const firstDeps = buildDeps();
    await runRefresh(firstDeps, 200);
    const firstPayload = (firstDeps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];

    const deps = buildDeps({
      readExistingRepos: () => firstPayload.repos,
      writeRepos: vi.fn(),
      writeMeta: vi.fn(),
    });
    const result = await runRefresh(deps, 200);

    expect(result.wrote).toBe(false);
    expect(deps.writeRepos).not.toHaveBeenCalled();
    expect(deps.writeMeta).not.toHaveBeenCalled();
  });

  it('sorts repos by score desc, with owner/name tiebreak for determinism', async () => {
    const deps = buildDeps({
      discoverTopRepos: vi.fn().mockResolvedValue([
        meta({ owner: 'z', stars: 10 }),
        meta({ owner: 'a', stars: 10 }),
        meta({ owner: 'm', stars: 10 }),
      ]),
      // All three get identical content → identical scores → tiebreak on owner asc
      fetchClaudeMd: vi.fn(async () => file('be concise')),
    });
    await runRefresh(deps, 200);
    const payload = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.repos.map((r: RepoEntry) => r.owner)).toEqual(['a', 'm', 'z']);
  });

  it('honours the limit parameter passed to discoverTopRepos', async () => {
    const spy = vi.fn().mockResolvedValue([]);
    const deps = buildDeps({ discoverTopRepos: spy });
    await runRefresh(deps, 200);
    expect(spy).toHaveBeenCalledWith(200);
  });

  it('carries over semantic fields from prev on a repo whose deterministic fields change', async () => {
    // prev: char_count=5 triggers a write; semantic fields from a prior
    // semantic pass must survive the deterministic rebuild.
    const prevEntry: RepoEntry = {
      owner: 'one',
      name: 'widget',
      stars: 1000,
      char_count: 5,
      score: 0,
      last_commit_at: '2026-04-10T12:00:00Z',
      matches: [],
      semantic_score: 8,
      semantic_matched_intents: [
        { quote: 'q', reason: 'duplicates default', confidence: 'high' },
      ],
      semantic_refreshed_at: '2026-04-18T06:00:00.000Z',
      semantic_content_hash: 'abc123',
    };
    const deps = buildDeps({
      readExistingRepos: () => [prevEntry],
      discoverTopRepos: vi.fn().mockResolvedValue([
        meta({ owner: 'one', stars: 1000 }),
      ]),
      fetchClaudeMd: vi.fn(async () => file('one: be concise and no emojis')),
    });
    await runRefresh(deps, 200);
    const payload = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const entry = payload.repos[0];
    expect(entry.semantic_score).toBe(8);
    expect(entry.semantic_matched_intents).toEqual([
      { quote: 'q', reason: 'duplicates default', confidence: 'high' },
    ]);
    expect(entry.semantic_refreshed_at).toBe('2026-04-18T06:00:00.000Z');
    expect(entry.semantic_content_hash).toBe('abc123');
    // deterministic score updated by the rebuild
    expect(entry.score).toBe(100);
  });

  it('does not fabricate semantic fields on repos that have no prev', async () => {
    const deps = buildDeps();
    await runRefresh(deps, 200);
    const payload = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.repos[0].semantic_score).toBeUndefined();
    expect(payload.repos[0].semantic_matched_intents).toBeUndefined();
    expect(payload.repos[0].semantic_content_hash).toBeUndefined();
  });
});

describe('runSemanticPass()', () => {
  const basePayload = (): ReposPayload => ({
    refreshed_at: '2026-04-17T00:00:00.000Z',
    repos: [
      {
        owner: 'one',
        name: 'widget',
        stars: 1000,
        char_count: 100,
        score: 50,
        last_commit_at: '2026-04-10T12:00:00Z',
        matches: ['a'],
      },
      {
        owner: 'two',
        name: 'widget',
        stars: 900,
        char_count: 50,
        score: 0,
        last_commit_at: '2026-04-10T12:00:00Z',
        matches: [],
      },
    ],
  });

  const semResult = (over: Partial<SemanticResult> = {}): SemanticResult => ({
    semantic_score: 4,
    matched_intents: [{ quote: 'q', reason: 'r', confidence: 'high' }],
    ...over,
  });

  const buildSemDeps = (over: Partial<SemanticPassDeps> = {}): SemanticPassDeps => ({
    readExistingPayload: () => basePayload(),
    fetchClaudeMd: vi.fn(async () => file('some file content')),
    enrich: vi.fn(async () => semResult()),
    writeRepos: vi.fn(),
    now: () => new Date('2026-04-18T06:00:00Z'),
    hashContent: (c: string) => `hash-${c.length}`,
    ...over,
  });

  it('enriches every repo when no semantic fields exist yet', async () => {
    const deps = buildSemDeps();
    const result = await runSemanticPass(deps);

    expect(result.wrote).toBe(true);
    expect(result.enriched).toBe(2);
    expect(result.cached).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(deps.enrich).toHaveBeenCalledTimes(2);

    const written = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written.refreshed_at).toBe('2026-04-17T00:00:00.000Z');
    expect(written.repos[0].semantic_score).toBe(4);
    expect(written.repos[0].semantic_matched_intents).toEqual([
      { quote: 'q', reason: 'r', confidence: 'high' },
    ]);
    expect(written.repos[0].semantic_refreshed_at).toBe('2026-04-18T06:00:00.000Z');
    expect(written.repos[0].semantic_content_hash).toBe('hash-17');
    // deterministic fields untouched
    expect(written.repos[0].score).toBe(50);
    expect(written.repos[0].matches).toEqual(['a']);
  });

  it('caches by content hash — skips enrichment when hash unchanged', async () => {
    const cached = basePayload();
    cached.repos = cached.repos.map((r) => ({
      ...r,
      semantic_score: 2,
      semantic_matched_intents: [],
      semantic_refreshed_at: '2026-04-17T06:00:00.000Z',
      semantic_content_hash: 'hash-17',
    }));
    const enrichSpy = vi.fn();
    const deps = buildSemDeps({
      readExistingPayload: () => cached,
      enrich: enrichSpy,
    });
    const result = await runSemanticPass(deps);

    expect(enrichSpy).not.toHaveBeenCalled();
    expect(result.cached).toBe(2);
    expect(result.enriched).toBe(0);

    const written = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written.repos[0].semantic_score).toBe(2);
    expect(written.repos[0].semantic_refreshed_at).toBe('2026-04-17T06:00:00.000Z');
  });

  it('re-enriches when content hash differs from stored hash', async () => {
    const stale = basePayload();
    stale.repos = stale.repos.map((r) => ({
      ...r,
      semantic_score: 2,
      semantic_matched_intents: [],
      semantic_refreshed_at: '2026-04-17T06:00:00.000Z',
      semantic_content_hash: 'OLD-HASH',
    }));
    const enrichSpy = vi.fn(async () => semResult());
    const deps = buildSemDeps({
      readExistingPayload: () => stale,
      enrich: enrichSpy,
    });
    const result = await runSemanticPass(deps);

    expect(enrichSpy).toHaveBeenCalledTimes(2);
    expect(result.enriched).toBe(2);
    expect(result.cached).toBe(0);

    const written = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written.repos[0].semantic_content_hash).toBe('hash-17');
    expect(written.repos[0].semantic_refreshed_at).toBe('2026-04-18T06:00:00.000Z');
  });

  it('isolates a single-repo API failure — others still enriched, deterministic fields untouched', async () => {
    let call = 0;
    const enrichSpy = vi.fn(async () => {
      call++;
      if (call === 1) throw new Error('API 500');
      return semResult();
    });
    const deps = buildSemDeps({ enrich: enrichSpy });
    const result = await runSemanticPass(deps);

    expect(result.enriched).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.wrote).toBe(true);

    const written = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Repo 1 failed — no prior semantic fields, so they stay undefined
    expect(written.repos[0].semantic_score).toBeUndefined();
    // Repo 2 succeeded
    expect(written.repos[1].semantic_score).toBe(4);
    // Deterministic fields unchanged on both
    expect(written.repos[0].score).toBe(50);
    expect(written.repos[1].score).toBe(0);
    expect(written.repos[0].matches).toEqual(['a']);
  });

  it('preserves prior semantic fields when re-enrichment fails', async () => {
    const stale = basePayload();
    stale.repos = [
      {
        ...stale.repos[0],
        semantic_score: 2,
        semantic_matched_intents: [{ quote: 'old', reason: 'old', confidence: 'low' }],
        semantic_refreshed_at: '2026-04-17T06:00:00.000Z',
        semantic_content_hash: 'OLD-HASH',
      },
    ];
    const deps = buildSemDeps({
      readExistingPayload: () => stale,
      enrich: vi.fn(async () => {
        throw new Error('API 500');
      }),
    });
    await runSemanticPass(deps);

    const written = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(written.repos[0].semantic_score).toBe(2);
    expect(written.repos[0].semantic_matched_intents).toEqual([
      { quote: 'old', reason: 'old', confidence: 'low' },
    ]);
    expect(written.repos[0].semantic_refreshed_at).toBe('2026-04-17T06:00:00.000Z');
    expect(written.repos[0].semantic_content_hash).toBe('OLD-HASH');
  });

  it('skips repos whose CLAUDE.md fetch returns null', async () => {
    const deps = buildSemDeps({
      fetchClaudeMd: vi.fn(async (owner: string) =>
        owner === 'two' ? null : file('content here'),
      ),
    });
    const result = await runSemanticPass(deps);

    expect(result.enriched).toBe(1);
    expect(result.skipped).toBe(1);

    const written = (deps.writeRepos as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const two = written.repos.find((r: RepoEntry) => r.owner === 'two');
    expect(two.semantic_score).toBeUndefined();
  });

  it('returns wrote:false when repos.json is absent', async () => {
    const deps = buildSemDeps({ readExistingPayload: () => null });
    const result = await runSemanticPass(deps);

    expect(result.wrote).toBe(false);
    expect(result.enriched).toBe(0);
    expect(deps.writeRepos).not.toHaveBeenCalled();
  });
});
