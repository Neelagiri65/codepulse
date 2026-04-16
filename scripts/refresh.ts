import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Octokit } from '@octokit/rest';
import { score, type Pattern } from '../src/score';

export interface RepoMeta {
  owner: string;
  name: string;
  stars: number;
}

export interface ClaudeMdFile {
  content: string;
  last_commit_at: string;
  char_count: number;
}

export interface RepoEntry {
  owner: string;
  name: string;
  stars: number;
  char_count: number;
  score: number;
  last_commit_at: string;
  matches: string[];
}

export interface ReposPayload {
  refreshed_at: string;
  repos: RepoEntry[];
}

export interface MetaPayload {
  tool_version: string;
  catalogue_version: number;
  last_refresh_at: string;
}

export interface RefreshDeps {
  discoverTopRepos: (limit: number) => Promise<RepoMeta[]>;
  fetchClaudeMd: (owner: string, name: string) => Promise<ClaudeMdFile | null>;
  readCatalogue: () => Pattern[];
  readExistingRepos: () => RepoEntry[] | null;
  writeRepos: (payload: ReposPayload) => void;
  writeMeta: (payload: MetaPayload) => void;
  now: () => Date;
  toolVersion: string;
  catalogueVersion: number;
}

export interface RefreshResult {
  wrote: boolean;
  count: number;
  skipped: number;
}

export const scoreRepo = (
  meta: RepoMeta,
  file: ClaudeMdFile,
  catalogue: Pattern[],
): RepoEntry => {
  const card = score(file.content, catalogue);
  return {
    owner: meta.owner,
    name: meta.name,
    stars: meta.stars,
    char_count: file.char_count,
    score: card.redundancyScore,
    last_commit_at: file.last_commit_at,
    matches: card.matches.map((m) => m.patternId),
  };
};

export const shouldWrite = (prev: RepoEntry[] | null, next: RepoEntry[]): boolean => {
  if (prev === null) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (
      a.owner !== b.owner ||
      a.name !== b.name ||
      a.stars !== b.stars ||
      a.char_count !== b.char_count ||
      a.score !== b.score ||
      a.last_commit_at !== b.last_commit_at ||
      a.matches.length !== b.matches.length ||
      a.matches.some((id, j) => id !== b.matches[j])
    ) {
      return true;
    }
  }
  return false;
};

const sortRepos = (rows: RepoEntry[]): RepoEntry[] =>
  [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.owner !== b.owner) return a.owner.localeCompare(b.owner);
    return a.name.localeCompare(b.name);
  });

export const runRefresh = async (
  deps: RefreshDeps,
  limit: number,
): Promise<RefreshResult> => {
  const repoMetas = await deps.discoverTopRepos(limit);
  const catalogue = deps.readCatalogue();
  const rows: RepoEntry[] = [];
  let skipped = 0;

  for (const meta of repoMetas) {
    const file = await deps.fetchClaudeMd(meta.owner, meta.name);
    if (file === null) {
      skipped++;
      continue;
    }
    rows.push(scoreRepo(meta, file, catalogue));
  }

  const sorted = sortRepos(rows);
  const prev = deps.readExistingRepos();

  if (!shouldWrite(prev, sorted)) {
    return { wrote: false, count: sorted.length, skipped };
  }

  const refreshedAt = deps.now().toISOString();
  deps.writeRepos({ refreshed_at: refreshedAt, repos: sorted });
  deps.writeMeta({
    tool_version: deps.toolVersion,
    catalogue_version: deps.catalogueVersion,
    last_refresh_at: refreshedAt,
  });

  return { wrote: true, count: sorted.length, skipped };
};

// ---------- Real-dep CLI wiring (only runs when invoked directly) ----------

const makeDiscover =
  (octokit: Octokit) =>
  async (limit: number): Promise<RepoMeta[]> => {
    // GitHub code search has no stars sort; we discover via code search,
    // dedupe by repo, enrich each with a stars lookup, sort locally.
    const seen = new Map<string, { owner: string; name: string }>();
    const PER_PAGE = 100;
    const MAX_PAGES = 10; // GitHub caps search pagination at 1000 results

    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await octokit.search.code({
        q: 'filename:CLAUDE.md path:/',
        per_page: PER_PAGE,
        page,
      });
      for (const item of res.data.items) {
        const full = item.repository.full_name;
        if (!seen.has(full)) {
          seen.set(full, {
            owner: item.repository.owner.login,
            name: item.repository.name,
          });
        }
      }
      if (res.data.items.length < PER_PAGE) break;
    }

    const enriched: RepoMeta[] = [];
    for (const { owner, name } of seen.values()) {
      try {
        const { data } = await octokit.repos.get({ owner, repo: name });
        enriched.push({ owner, name, stars: data.stargazers_count });
      } catch {
        // repo unavailable (private, deleted, moved) — drop it
      }
    }

    enriched.sort((a, b) => b.stars - a.stars);
    return enriched.slice(0, limit);
  };

const makeFetcher =
  (octokit: Octokit) =>
  async (owner: string, name: string): Promise<ClaudeMdFile | null> => {
    let content: string;
    try {
      const { data } = await octokit.repos.getContent({
        owner,
        repo: name,
        path: 'CLAUDE.md',
      });
      if (Array.isArray(data) || data.type !== 'file' || typeof data.content !== 'string') {
        return null;
      }
      content = Buffer.from(data.content, 'base64').toString('utf8');
    } catch {
      return null;
    }

    let last_commit_at = '';
    try {
      const { data: commits } = await octokit.repos.listCommits({
        owner,
        repo: name,
        path: 'CLAUDE.md',
        per_page: 1,
      });
      last_commit_at = commits[0]?.commit?.committer?.date ?? commits[0]?.commit?.author?.date ?? '';
    } catch {
      // leave last_commit_at empty if commit list fails
    }

    return {
      content,
      last_commit_at,
      char_count: content.length,
    };
  };

const isDirectInvocation = () =>
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1]?.endsWith('refresh.ts');

if (isDirectInvocation()) {
  const token = process.env.GH_TOKEN;
  if (!token) {
    console.error('GH_TOKEN not set — refusing to run unauthenticated (code search requires auth)');
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });
  const dataDir = resolve(process.cwd(), 'data');
  const cataloguePath = resolve(dataDir, 'catalogue.json');
  const reposPath = resolve(dataDir, 'repos.json');
  const metaPath = resolve(dataDir, 'meta.json');
  const pkgPath = resolve(process.cwd(), 'package.json');

  const cataloguefile = JSON.parse(readFileSync(cataloguePath, 'utf8')) as {
    version: number;
    patterns: Pattern[];
  };
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };

  const deps: RefreshDeps = {
    discoverTopRepos: makeDiscover(octokit),
    fetchClaudeMd: makeFetcher(octokit),
    readCatalogue: () => cataloguefile.patterns,
    readExistingRepos: () => {
      if (!existsSync(reposPath)) return null;
      try {
        const raw = JSON.parse(readFileSync(reposPath, 'utf8')) as { repos?: RepoEntry[] };
        return Array.isArray(raw.repos) ? raw.repos : null;
      } catch {
        return null;
      }
    },
    writeRepos: (payload) => {
      writeFileSync(reposPath, JSON.stringify(payload, null, 2) + '\n');
    },
    writeMeta: (payload) => {
      writeFileSync(metaPath, JSON.stringify(payload, null, 2) + '\n');
    },
    now: () => new Date(),
    toolVersion: pkg.version,
    catalogueVersion: cataloguefile.version,
  };

  runRefresh(deps, 200)
    .then((result) => {
      if (result.wrote) {
        console.log(
          `refresh: wrote ${result.count} repos, skipped ${result.skipped}`,
        );
      } else {
        console.log(`refresh: no change (${result.count} repos, skipped ${result.skipped})`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('refresh FAILED:', err);
      process.exit(1);
    });
}
