// Select a stratified sample of CLAUDE.md files from data/repos.json and fetch
// them for manual extraction (issue #8 methodology).
//
// Usage:
//   pnpm exec tsx scripts/sample-claude-mds.ts \
//     [--n-clean 6] [--n-dirty 4] [--seed 0] \
//     [--repos data/repos.json] \
//     [--out /tmp/codepulse-samples-v0.1.x]
//
// Uses GH_TOKEN when set; falls back to unauthenticated fetches (OK for <10
// files against the 60/hr bucket, but set GH_TOKEN if the samples keep growing).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Octokit } from '@octokit/rest';

export type SamplingRepo = { owner: string; name: string; score: number };

export type StratifyOpts = { nClean: number; nDirty: number; seed: number };

export type SamplingDeps = {
  readRepos: (path: string) => SamplingRepo[];
  fetchClaudeMd: (owner: string, name: string) => Promise<string | null>;
  writeSample: (path: string, content: string) => void;
  log: (msg: string) => void;
};

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function stratify(
  repos: SamplingRepo[],
  opts: StratifyOpts,
): { owner: string; name: string }[] {
  const clean = repos.filter((r) => r.score === 0);
  const dirty = repos.filter((r) => r.score >= 1 && r.score <= 25);
  const rand = prng(opts.seed);
  const pickClean = shuffle(clean, rand).slice(0, opts.nClean);
  const pickDirty = shuffle(dirty, rand).slice(0, opts.nDirty);
  return [...pickClean, ...pickDirty].map(({ owner, name }) => ({ owner, name }));
}

export async function runSampling(
  opts: StratifyOpts & { reposPath: string; outDir: string },
  deps: SamplingDeps,
): Promise<number> {
  const all = deps.readRepos(opts.reposPath);
  const picks = stratify(all, opts);
  deps.log(
    `selected ${picks.length} repos (nClean=${opts.nClean}, nDirty=${opts.nDirty}, seed=${opts.seed})`,
  );
  let ok = 0;
  for (const { owner, name } of picks) {
    const content = await deps.fetchClaudeMd(owner, name);
    if (content === null) {
      deps.log(`  skip ${owner}/${name} — fetch failed`);
      continue;
    }
    const file = resolve(opts.outDir, `${owner}__${name}.md`);
    deps.writeSample(file, content);
    deps.log(`  wrote ${file}`);
    ok++;
  }
  return ok;
}

function parseArgs(argv: string[]): {
  nClean: number;
  nDirty: number;
  seed: number;
  reposPath: string;
  outDir: string;
} {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : fallback;
  };
  return {
    nClean: Number(get('--n-clean', '6')),
    nDirty: Number(get('--n-dirty', '4')),
    seed: Number(get('--seed', '0')),
    reposPath: get('--repos', 'data/repos.json'),
    outDir: get('--out', '/tmp/codepulse-samples-v0.1.x'),
  };
}

function isMain(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && entry.endsWith('sample-claude-mds.ts');
}

if (isMain()) {
  const args = parseArgs(process.argv.slice(2));
  const octokit = new Octokit({ auth: process.env.GH_TOKEN });
  mkdirSync(args.outDir, { recursive: true });

  const deps: SamplingDeps = {
    readRepos: (path) => {
      const parsed = JSON.parse(readFileSync(resolve(path), 'utf8'));
      return parsed.repos as SamplingRepo[];
    },
    fetchClaudeMd: async (owner, name) => {
      try {
        const res = await octokit.repos.getContent({ owner, repo: name, path: 'CLAUDE.md' });
        const data = res.data as { content?: string; encoding?: string };
        if (!data.content || data.encoding !== 'base64') return null;
        return Buffer.from(data.content, 'base64').toString('utf8');
      } catch {
        return null;
      }
    },
    writeSample: (path, content) => {
      writeFileSync(path, content, 'utf8');
    },
    log: (msg) => console.log(msg),
  };

  runSampling(args, deps).then((ok) => {
    console.log(`\ndone — ${ok} file(s) written to ${args.outDir}`);
    if (ok === 0) process.exit(1);
  });
}
