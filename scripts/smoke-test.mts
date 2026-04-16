// Score the catalogue against a directory of sample CLAUDE.md files.
// Usage: pnpm exec tsx scripts/smoke-test.mts [samples-dir] [catalogue-path]
// Defaults: /tmp/codepulse-samples, data/catalogue.json
//
// Run this whenever catalogue entries are added, removed, or re-scoped.
// Inspect each excerpt and ask: is this CLAUDE.md line actually restating a
// default, or is it project-specific guidance that should not be flagged?

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { score, type Pattern } from '../src/score';

const samplesDir = resolve(process.argv[2] ?? '/tmp/codepulse-samples');
const cataloguePath = resolve(process.argv[3] ?? 'data/catalogue.json');

if (!existsSync(samplesDir)) {
  console.error(`samples directory not found: ${samplesDir}`);
  console.error('populate it with real CLAUDE.md files (e.g. via gh api) before running.');
  process.exit(2);
}

const catalogue = JSON.parse(readFileSync(cataloguePath, 'utf8')).patterns as Pattern[];
const files = readdirSync(samplesDir).filter(f => f.endsWith('.md')).sort();

console.log(`catalogue: ${cataloguePath} (${catalogue.length} entries)`);
console.log(`samples:   ${samplesDir} (${files.length} files)\n`);

console.log(`${'file'.padEnd(28)} ${'score'.padStart(6)} ${'hits'.padStart(5)}`);
console.log('-'.repeat(42));

const allMatches: { file: string; score: number; matches: ReturnType<typeof score>['matches'] }[] = [];
for (const f of files) {
  const content = readFileSync(`${samplesDir}/${f}`, 'utf8');
  const sc = score(content, catalogue);
  allMatches.push({ file: f, score: sc.redundancyScore, matches: sc.matches });
  console.log(`${f.padEnd(28)} ${String(sc.redundancyScore).padStart(6)} ${String(sc.matches.length).padStart(5)}`);
}

console.log('\nEXCERPTS (review each — true positive or false positive?):');
for (const r of allMatches) {
  if (r.matches.length === 0) continue;
  console.log(`\n--- ${r.file} (score ${r.score}) ---`);
  for (const m of r.matches) {
    console.log(`  [${m.patternId}] w=${m.weight}`);
    console.log(`    "${m.excerpt}"`);
  }
}
