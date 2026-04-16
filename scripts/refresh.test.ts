import { describe, it, expect, vi } from 'vitest';
import type { Pattern } from '../src/score';
import {
  scoreRepo,
  shouldWrite,
  runRefresh,
  type ClaudeMdFile,
  type RefreshDeps,
  type RepoEntry,
  type RepoMeta,
} from './refresh';

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
    expect(entry.char_count).toBe(30);
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
});
