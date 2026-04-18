import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Octokit } from '@octokit/rest';
import {
  makeFetcher,
  runSemanticPass,
  type ReposPayload,
  type SemanticPassDeps,
} from './refresh';
import { enrichSemanticScore } from './enrich';

const token = process.env.GH_TOKEN;
if (!token) {
  console.error('GH_TOKEN not set — refusing to run unauthenticated');
  process.exit(1);
}

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY not set — semantic pass cannot run');
  process.exit(1);
}

const octokit = new Octokit({ auth: token });
const dataDir = resolve(process.cwd(), 'data');
const reposPath = resolve(dataDir, 'repos.json');

const deps: SemanticPassDeps = {
  readExistingPayload: () => {
    if (!existsSync(reposPath)) return null;
    try {
      return JSON.parse(readFileSync(reposPath, 'utf8')) as ReposPayload;
    } catch {
      return null;
    }
  },
  fetchClaudeMd: makeFetcher(octokit),
  enrich: (content) => enrichSemanticScore(content, { model: 'gemini-2.5-flash', apiKey }),
  writeRepos: (payload) => {
    writeFileSync(reposPath, JSON.stringify(payload, null, 2) + '\n');
  },
  now: () => new Date(),
};

runSemanticPass(deps)
  .then((r) => {
    if (!r.wrote) {
      console.log('semantic: no repos.json to enrich — skipping');
      process.exit(0);
    }
    console.log(
      `semantic: enriched=${r.enriched} cached=${r.cached} failed=${r.failed} skipped=${r.skipped}`,
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error('semantic FAILED:', err);
    process.exit(1);
  });
