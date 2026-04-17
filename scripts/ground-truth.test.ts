// Ground-truth harness for Issue #10 — grades enrichSemanticScore() against
// the 5 manually-reviewed fixtures in docs/ground-truth-2026-04-17.md.
//
// Acceptance bar (from the doc and docs/issues-v0.1.x-catalogue-depth.md #10):
//   - zenml-io/zenml: surfaces >=4 of the 5 documented redundancies with
//     matching quotes.
//   - ironclaw, supercmd, javascript-obfuscator, overstory: zero HIGH-
//     confidence flags. Low/medium borderline hits on the documented edge
//     cases (ironclaw "Comments for non-obvious logic only", overstory
//     "Quality Gates") are tolerated.
//
// Runs only when ANTHROPIC_API_KEY is set. Parametrised over Haiku 4.5 and
// Sonnet 4.6 so we can pick on precision per the session brief.

import { describe, it, expect, beforeAll } from 'vitest';
import { enrichSemanticScore, type MatchedIntent, type ModelId } from './enrich';

const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY);

const FIXTURES = {
  zenml: 'https://raw.githubusercontent.com/zenml-io/zenml/main/CLAUDE.md',
  ironclaw: 'https://raw.githubusercontent.com/nearai/ironclaw/main/CLAUDE.md',
  supercmd: 'https://raw.githubusercontent.com/SuperCmdLabs/SuperCmd/main/CLAUDE.md',
  jsobf:
    'https://raw.githubusercontent.com/javascript-obfuscator/javascript-obfuscator/master/CLAUDE.md',
  overstory: 'https://raw.githubusercontent.com/jayminwest/overstory/main/CLAUDE.md',
} as const;

type FixtureName = keyof typeof FIXTURES;

// Distinctive substrings that anchor each of the 5 zenml redundancies. A
// matched quote counts toward a redundancy if it contains ANY of that
// redundancy's anchor substrings (case-insensitive). Anchors are lifted
// verbatim from docs/ground-truth-2026-04-17.md so rephrased model quotes
// still bucket correctly.
const ZENML_REDUNDANCIES: Array<{ id: string; anchors: string[] }> = [
  {
    id: 'commenting-policy',
    anchors: ['explain why, not what', 'why, not what', 'why not what'],
  },
  {
    id: 'commit-message-why-not-what',
    anchors: ["'why' not just the 'what'", 'why not just the what', "the 'why' not"],
  },
  {
    id: 'commit-formatting',
    anchors: ['50 chars', 'imperative mood', 'concise summary'],
  },
  {
    id: 'root-cause-before-fix',
    anchors: ['root cause', 'regression test'],
  },
  {
    id: 'task-planning',
    anchors: ['break down', 'sub-task', 'plan approach', 'test incrementally'],
  },
];

const MODELS: ModelId[] = ['claude-haiku-4-5-20251001', 'claude-sonnet-4-6'];

const fixtureCache = new Map<FixtureName, string>();

async function loadFixture(name: FixtureName): Promise<string> {
  const cached = fixtureCache.get(name);
  if (cached) return cached;
  const res = await fetch(FIXTURES[name]);
  if (!res.ok) throw new Error(`fetch ${name} ${FIXTURES[name]} -> ${res.status}`);
  const body = await res.text();
  fixtureCache.set(name, body);
  return body;
}

function redundanciesHit(intents: MatchedIntent[]): string[] {
  const hits = new Set<string>();
  for (const intent of intents) {
    const q = intent.quote.toLowerCase();
    for (const { id, anchors } of ZENML_REDUNDANCIES) {
      if (anchors.some((a) => q.includes(a.toLowerCase()))) hits.add(id);
    }
  }
  return [...hits];
}

describe.runIf(HAS_KEY)('ground-truth fixture — Issue #10 acceptance', () => {
  beforeAll(async () => {
    await Promise.all((Object.keys(FIXTURES) as FixtureName[]).map(loadFixture));
  }, 60_000);

  for (const model of MODELS) {
    describe(`model ${model}`, () => {
      it(
        'flags >=4 of 5 documented redundancies in zenml-io/zenml',
        async () => {
          const content = await loadFixture('zenml');
          const result = await enrichSemanticScore(content, { model });
          const hit = redundanciesHit(result.matched_intents);
          expect(
            hit.length,
            `expected >=4 of 5 zenml redundancies; hit: ${hit.join(', ')}`,
          ).toBeGreaterThanOrEqual(4);
        },
        180_000,
      );

      for (const clean of ['ironclaw', 'supercmd', 'jsobf', 'overstory'] as const) {
        it(
          `does not HIGH-confidence flag anything in ${clean}`,
          async () => {
            const content = await loadFixture(clean);
            const result = await enrichSemanticScore(content, { model });
            const highConf = result.matched_intents.filter((i) => i.confidence === 'high');
            expect(
              highConf,
              `HIGH-confidence flags on clean file ${clean}: ` +
                JSON.stringify(highConf, null, 2),
            ).toEqual([]);
          },
          180_000,
        );
      }
    });
  }
});

describe.skipIf(HAS_KEY)('ground-truth fixture — skipped (no ANTHROPIC_API_KEY)', () => {
  it('set ANTHROPIC_API_KEY to run the ground-truth harness', () => {
    expect(HAS_KEY).toBe(false);
  });
});
