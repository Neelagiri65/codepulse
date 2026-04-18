/**
 * @vitest-environment happy-dom
 *
 * DOM-structure smoke test for the leaderboard + paste-audit mounts.
 * Not a pixel/layout verifier — that still needs a human eye. This file
 * catches "component renders nothing", "header text wrong", "histogram
 * bar count miscomputed", "score pill colour bucket inverted" etc.
 */
import { describe, expect, it } from 'vitest';
import reposData from '../data/repos.json' with { type: 'json' };
import catalogueData from '../data/catalogue.json' with { type: 'json' };
import { mountLeaderboard, type CatalogueCoverage, type ReposFile, type RepoRow } from './leaderboard';
import { mountAudit, type CatalogueFile } from './audit';
import { bucketForScore, distribution, blendedScore } from './format';

const repos = reposData as ReposFile;
const catalogue = catalogueData as CatalogueFile;
const coverage: CatalogueCoverage = {
  version: catalogue.version,
  patternCount: catalogue.patterns.length,
  methodologyUrl: 'https://example.test/methodology',
};

// Derive expected values from the live data files rather than hard-coding,
// so the suite stays green across hourly cron refreshes. The production
// renderer uses the same `distribution()` helper and blended() formula as
// the UI, so the test checks "UI reflects the data" not "UI matches a
// number baked in when this test was written."
const expected = (() => {
  const blendedScores = repos.repos.map(blendedScore);
  const dist = distribution(blendedScores);
  return {
    refreshedDate: repos.refreshed_at.slice(0, 10),
    total: repos.repos.length,
    cleanPct: dist.cleanPct,
    median: dist.median,
    max: dist.max,
    bucketCounts: dist.buckets.map((b) => String(b.count)),
    bucketLabels: dist.buckets.map((b) => b.label),
    anySemantic: repos.repos.some((r) => r.semantic_score !== undefined && r.semantic_score !== null),
  };
})();

const mountNode = (): HTMLElement => {
  const div = document.createElement('div');
  document.body.appendChild(div);
  return div;
};

describe('leaderboard mount — live data', () => {
  const host = mountNode();
  mountLeaderboard(host, repos, coverage);

  it('renders the CODEPULSE wordmark and refreshed-at', () => {
    expect(host.querySelector('.wordmark')?.textContent).toBe('CODEPULSE');
    expect(host.querySelector('.refreshed')?.textContent).toContain(expected.refreshedDate);
  });

  it('renders the honest-data hero headline against real data', () => {
    const headline = host.querySelector('.hero-headline');
    expect(headline?.textContent).toContain(`${expected.total} CLAUDE.md files measured`);
    expect(headline?.textContent).toContain(`${expected.cleanPct}% clean`);
    expect(headline?.querySelector('.accent')?.textContent).toBe(`${expected.cleanPct}% clean`);
  });

  it('renders the hero sub with median + max + catalogue version', () => {
    const sub = host.querySelector('.hero-sub');
    expect(sub?.textContent).toBe(
      `median redundancy ${expected.median} · max ${expected.max} · catalogue v${catalogue.version}`,
    );
  });

  it('renders the confidence caption with live pattern count + methodology link', () => {
    const confidence = host.querySelector('.hero-confidence');
    expect(confidence?.textContent).toContain(`Scored against ${coverage.patternCount} catalogue patterns`);
    expect(confidence?.textContent).toContain('narrow scan, not a comprehensive audit');
    const link = confidence?.querySelector('.hero-methodology-link') as HTMLAnchorElement;
    expect(link?.textContent).toBe('Methodology →');
    expect(link?.href).toBe(coverage.methodologyUrl);
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toContain('noopener');
  });

  it('renders 5 histogram bars with correct bucket counts', () => {
    const cols = host.querySelectorAll('.histogram-col');
    expect(cols.length).toBe(5);
    const counts = Array.from(cols).map(
      (c) => c.querySelector('.histogram-count')?.textContent,
    );
    expect(counts).toEqual(expected.bucketCounts);
    const labels = Array.from(cols).map(
      (c) => c.querySelector('.histogram-label')?.textContent,
    );
    expect(labels).toEqual(expected.bucketLabels);
  });

  it('zero-count buckets have no bar colour variable set (no fake data)', () => {
    const bars = host.querySelectorAll('.histogram-bar');
    const zeroBuckets = [bars[2], bars[3], bars[4]] as HTMLElement[];
    zeroBuckets.forEach((bar) => {
      expect(bar.style.getPropertyValue('--bar-colour')).toBe('');
    });
  });

  it('renders a row per repo, score-desc default sort', () => {
    const rows = host.querySelectorAll('.leaderboard-table tbody tr');
    expect(rows.length).toBe(expected.total);
    const firstScore = rows[0].querySelector('.col-score .pill')?.textContent;
    const lastScore = rows[rows.length - 1].querySelector('.col-score .pill')?.textContent;
    expect(Number(firstScore)).toBeGreaterThanOrEqual(Number(lastScore));
    expect(Number(firstScore)).toBe(expected.max);
  });

  it('each row links to the repo on GitHub', () => {
    const rows = host.querySelectorAll('.leaderboard-table tbody tr');
    const first = rows[0] as HTMLTableRowElement;
    expect(first.dataset.url).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  });

  it('score pill colour tracks the health bucket', () => {
    const rows = host.querySelectorAll('.leaderboard-table tbody tr');
    const topPill = rows[0].querySelector('.col-score .pill') as HTMLElement;
    const topScore = Number(topPill.textContent);
    expect(topPill.style.getPropertyValue('--pill-colour')).toBe(
      `var(--health-${bucketForScore(topScore)})`,
    );
    const cleanRow = Array.from(rows).find(
      (r) => r.querySelector('.col-score .pill')?.textContent === '0',
    );
    if (cleanRow) {
      const cleanPill = cleanRow.querySelector('.col-score .pill') as HTMLElement;
      expect(cleanPill.style.getPropertyValue('--pill-colour')).toBe('var(--health-0)');
    }
  });

  it('score pill has accessible label', () => {
    const pill = host.querySelector('.col-score .pill');
    expect(pill?.getAttribute('aria-label')).toMatch(
      /^redundancy score \d+ of 100, (clean|mostly clean|some redundancy|notable redundancy|severe)$/,
    );
  });
});

describe('leaderboard mount — semantic-enriched fixture', () => {
  const fixture: ReposFile = {
    refreshed_at: '2026-04-18T06:00:00Z',
    repos: [
      {
        owner: 'alpha',
        name: 'one',
        stars: 500,
        char_count: 10000,
        score: 10,
        last_commit_at: '2026-04-10T12:00:00Z',
        matches: ['be-concise'],
        semantic_score: 28,
        semantic_matched_intents: [
          { quote: 'x', reason: 'y', confidence: 'high' },
        ],
        semantic_refreshed_at: '2026-04-18T06:00:00Z',
      },
      {
        owner: 'beta',
        name: 'two',
        stars: 200,
        char_count: 5000,
        score: 40,
        last_commit_at: '2026-04-12T12:00:00Z',
        matches: [],
      },
      {
        owner: 'gamma',
        name: 'three',
        stars: 100,
        char_count: 2000,
        score: 95,
        last_commit_at: '2026-04-14T12:00:00Z',
        matches: ['foo'],
        semantic_score: 20,
        semantic_matched_intents: [],
        semantic_refreshed_at: '2026-04-18T06:00:00Z',
      },
      {
        owner: 'delta',
        name: 'four',
        stars: 50,
        char_count: 1500,
        score: 60,
        last_commit_at: '2026-04-15T12:00:00Z',
        matches: ['bar'],
        semantic_score: 55,
        semantic_matched_intents: [],
        semantic_refreshed_at: '2026-04-18T06:00:00Z',
      },
    ] as RepoRow[],
  };
  const host = mountNode();
  mountLeaderboard(host, fixture, coverage);

  const rowsByRepo = () => {
    const rows = host.querySelectorAll('.leaderboard-table tbody tr');
    return new Map(
      Array.from(rows).map((r) => [
        (r.querySelector('.col-repo') as HTMLElement).textContent || '',
        r,
      ]),
    );
  };

  it('adds a Semantic column header when any row has semantic_score', () => {
    const headers = Array.from(host.querySelectorAll('.leaderboard-table thead th')).map((th) =>
      th.textContent?.replace(/[▲▼]/g, '').trim(),
    );
    expect(headers).toContain('Sem');
  });

  it('renders blended score pill as max(deterministic, semantic) capped at 100', () => {
    const rows = rowsByRepo();
    expect(rows.get('alpha/one')?.querySelector('.col-score .pill')?.textContent).toBe('28');
    expect(rows.get('beta/two')?.querySelector('.col-score .pill')?.textContent).toBe('40');
    expect(rows.get('gamma/three')?.querySelector('.col-score .pill')?.textContent).toBe('95');
    expect(rows.get('delta/four')?.querySelector('.col-score .pill')?.textContent).toBe('60');
  });

  it('shows raw semantic score in the Sem column; em-dash when missing', () => {
    const rows = rowsByRepo();
    expect(rows.get('alpha/one')?.querySelector('.col-semantic')?.textContent?.trim()).toBe('28');
    expect(rows.get('beta/two')?.querySelector('.col-semantic')?.textContent?.trim()).toBe('—');
    expect(rows.get('gamma/three')?.querySelector('.col-semantic')?.textContent?.trim()).toBe('20');
    expect(rows.get('delta/four')?.querySelector('.col-semantic')?.textContent?.trim()).toBe('55');
  });

  it('histogram uses blended scores (bucket reflects max of det/sem)', () => {
    const cols = host.querySelectorAll('.histogram-col');
    const counts = Array.from(cols).map((c) => c.querySelector('.histogram-count')?.textContent);
    // Blended: alpha=28, beta=40, gamma=95, delta=60
    // Buckets: 0, 1–25, 26–50, 51–75, 76–100
    expect(counts).toEqual(['0', '0', '2', '1', '1']);
  });

  it('default sort ranks by blended score descending', () => {
    const rows = host.querySelectorAll('.leaderboard-table tbody tr');
    const repos = Array.from(rows).map(
      (r) => (r.querySelector('.col-repo') as HTMLElement).textContent,
    );
    expect(repos).toEqual(['gamma/three', 'delta/four', 'beta/two', 'alpha/one']);
    const firstRank = (rows[0].querySelector('.col-rank') as HTMLElement).textContent;
    expect(firstRank).toBe('1');
  });
});

describe('leaderboard mount — no semantic data', () => {
  const fixture: ReposFile = {
    refreshed_at: '2026-04-18T06:00:00Z',
    repos: [
      {
        owner: 'a',
        name: 'b',
        stars: 1,
        char_count: 1000,
        score: 5,
        last_commit_at: '2026-04-01T00:00:00Z',
        matches: [],
      },
    ],
  };
  const host = mountNode();
  mountLeaderboard(host, fixture, coverage);

  it('omits the Sem column when no rows have semantic_score', () => {
    const headers = Array.from(host.querySelectorAll('.leaderboard-table thead th')).map((th) =>
      th.textContent?.replace(/[▲▼]/g, '').trim(),
    );
    expect(headers).not.toContain('Sem');
    expect(host.querySelector('.col-semantic')).toBeNull();
  });
});

describe('paste-audit mount', () => {
  const host = mountNode();
  mountAudit(host, catalogue);

  it('renders textarea + empty-state scorecard', () => {
    const ta = host.querySelector('.audit-textarea') as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    expect(ta.placeholder).toBe('Paste your CLAUDE.md here…');
    expect(host.querySelector('.scorecard-empty')?.textContent).toContain(
      'Paste a CLAUDE.md',
    );
  });

  it('shows the deterministic-only label (PRD §5.3 privacy contract)', () => {
    const note = host.querySelector('.audit-semantic-note');
    expect(note?.textContent).toContain('pasted audits use the deterministic catalogue');
    expect(note?.textContent).toContain(
      'leaderboard scores also include daily semantic enrichment',
    );
  });

  it('renders a real scorecard when content fires the input event', () => {
    const ta = host.querySelector('.audit-textarea') as HTMLTextAreaElement;
    ta.value = 'Be concise.\nNo emojis.\nPrefer editing existing files to creating new ones.';
    ta.dispatchEvent(new Event('input'));

    const pill = host.querySelector('.scorecard .pill');
    expect(pill).toBeTruthy();
    expect(Number(pill?.textContent)).toBeGreaterThan(0);

    const matches = host.querySelectorAll('.scorecard .match-item');
    expect(matches.length).toBeGreaterThanOrEqual(3);

    const ids = Array.from(matches).map((m) => m.querySelector('.match-id')?.textContent);
    expect(ids).toEqual(expect.arrayContaining(['be-concise', 'no-emojis']));
  });

  it('recovers to empty state when textarea is cleared', () => {
    const ta = host.querySelector('.audit-textarea') as HTMLTextAreaElement;
    ta.value = '';
    ta.dispatchEvent(new Event('input'));
    expect(host.querySelector('.scorecard-empty')).toBeTruthy();
  });

  it('renders clean state when a zero-match paste is scored', () => {
    const host2 = mountNode();
    mountAudit(host2, catalogue);
    const ta = host2.querySelector('.audit-textarea') as HTMLTextAreaElement;
    ta.value = 'This project uses the standard conventions of the framework.';
    ta.dispatchEvent(new Event('input'));
    expect(host2.querySelector('.scorecard-clean')).toBeTruthy();
    expect(host2.querySelector('.scorecard .pill')?.textContent).toBe('0');
  });
});
