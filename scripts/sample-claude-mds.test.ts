import { describe, it, expect, vi } from 'vitest';
import {
  stratify,
  runSampling,
  type SamplingRepo,
  type SamplingDeps,
} from './sample-claude-mds';

const r = (owner: string, name: string, score: number): SamplingRepo => ({
  owner,
  name,
  score,
});

describe('stratify()', () => {
  it('returns nClean + nDirty repos split by score bucket', () => {
    const repos = [
      r('a', '1', 0),
      r('b', '2', 0),
      r('c', '3', 0),
      r('d', '4', 0),
      r('e', '5', 1),
      r('f', '6', 5),
      r('g', '7', 8),
    ];
    const picks = stratify(repos, { nClean: 2, nDirty: 2, seed: 42 });
    expect(picks).toHaveLength(4);
    const lookup = (owner: string, name: string) =>
      repos.find((x) => x.owner === owner && x.name === name)!;
    expect(picks.filter((p) => lookup(p.owner, p.name).score === 0)).toHaveLength(2);
    expect(
      picks.filter((p) => {
        const rp = lookup(p.owner, p.name);
        return rp.score >= 1 && rp.score <= 25;
      }),
    ).toHaveLength(2);
  });

  it('is deterministic given the same seed', () => {
    const repos = Array.from({ length: 20 }, (_, i) =>
      r(`o${i}`, `n${i}`, i % 3 === 0 ? 0 : (i % 10) + 1),
    );
    const a = stratify(repos, { nClean: 3, nDirty: 3, seed: 7 });
    const b = stratify(repos, { nClean: 3, nDirty: 3, seed: 7 });
    expect(a).toEqual(b);
  });

  it('returns different selections for different seeds', () => {
    const repos = Array.from({ length: 30 }, (_, i) =>
      r(`o${i}`, `n${i}`, i % 2 === 0 ? 0 : (i % 15) + 1),
    );
    const a = stratify(repos, { nClean: 4, nDirty: 4, seed: 1 });
    const b = stratify(repos, { nClean: 4, nDirty: 4, seed: 2 });
    expect(a).not.toEqual(b);
  });

  it('returns all available if a bucket is smaller than requested', () => {
    const repos = [r('a', '1', 0), r('b', '2', 0), r('c', '3', 5)];
    const picks = stratify(repos, { nClean: 10, nDirty: 10, seed: 0 });
    expect(picks).toHaveLength(3);
  });

  it('ignores scores above 25 (higher buckets reserved for future)', () => {
    const repos = [r('a', '1', 0), r('b', '2', 30), r('c', '3', 50), r('d', '4', 10)];
    const picks = stratify(repos, { nClean: 10, nDirty: 10, seed: 0 });
    const owners = picks.map((p) => p.owner);
    expect(owners).toContain('a');
    expect(owners).toContain('d');
    expect(owners).not.toContain('b');
    expect(owners).not.toContain('c');
  });
});

describe('runSampling()', () => {
  it('writes one file per successful fetch and skips failures', async () => {
    const repos: SamplingRepo[] = [r('a', '1', 0), r('b', '2', 0), r('c', '3', 5)];
    const writes: Array<{ path: string; content: string }> = [];
    const deps: SamplingDeps = {
      readRepos: vi.fn().mockReturnValue(repos),
      fetchClaudeMd: vi.fn(async (owner) => (owner === 'b' ? null : `# ${owner}`)),
      writeSample: (path, content) => writes.push({ path, content }),
      log: vi.fn(),
    };
    const ok = await runSampling(
      { nClean: 3, nDirty: 3, seed: 0, reposPath: 'x.json', outDir: '/tmp/out' },
      deps,
    );
    expect(ok).toBe(2);
    expect(writes.map((w) => w.path.endsWith('.md'))).toEqual([true, true]);
    expect(writes.every((w) => w.content.startsWith('#'))).toBe(true);
  });
});
