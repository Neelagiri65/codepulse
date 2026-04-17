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
import { mountLeaderboard, type CatalogueCoverage, type ReposFile } from './leaderboard';
import { mountAudit, type CatalogueFile } from './audit';

const repos = reposData as ReposFile;
const catalogue = catalogueData as CatalogueFile;
const coverage: CatalogueCoverage = {
  version: catalogue.version,
  patternCount: catalogue.patterns.length,
  methodologyUrl: 'https://example.test/methodology',
};

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
    expect(host.querySelector('.refreshed')?.textContent).toContain('2026-04-16');
  });

  it('renders the honest-data hero headline against real data', () => {
    const headline = host.querySelector('.hero-headline');
    expect(headline?.textContent).toContain('186 CLAUDE.md files measured');
    expect(headline?.textContent).toContain('96% clean');
    expect(headline?.querySelector('.accent')?.textContent).toBe('96% clean');
  });

  it('renders the hero sub with median + max + catalogue version', () => {
    const sub = host.querySelector('.hero-sub');
    expect(sub?.textContent).toBe('median redundancy 0 · max 8 · catalogue v2');
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
    expect(counts).toEqual(['178', '8', '0', '0', '0']);
    const labels = Array.from(cols).map(
      (c) => c.querySelector('.histogram-label')?.textContent,
    );
    expect(labels).toEqual(['0', '1–25', '26–50', '51–75', '76–100']);
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
    expect(rows.length).toBe(186);
    const firstScore = rows[0].querySelector('.col-score .pill')?.textContent;
    const lastScore = rows[rows.length - 1].querySelector('.col-score .pill')?.textContent;
    expect(Number(firstScore)).toBeGreaterThanOrEqual(Number(lastScore));
    expect(Number(firstScore)).toBe(8);
  });

  it('each row links to the repo on GitHub', () => {
    const rows = host.querySelectorAll('.leaderboard-table tbody tr');
    const first = rows[0] as HTMLTableRowElement;
    expect(first.dataset.url).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  });

  it('score pill colour tracks the health bucket', () => {
    const rows = host.querySelectorAll('.leaderboard-table tbody tr');
    const topPill = rows[0].querySelector('.col-score .pill') as HTMLElement;
    expect(topPill.style.getPropertyValue('--pill-colour')).toBe('var(--health-1)');
    const cleanRow = Array.from(rows).find(
      (r) => r.querySelector('.col-score .pill')?.textContent === '0',
    );
    const cleanPill = cleanRow?.querySelector('.col-score .pill') as HTMLElement;
    expect(cleanPill.style.getPropertyValue('--pill-colour')).toBe('var(--health-0)');
  });

  it('score pill has accessible label', () => {
    const pill = host.querySelector('.col-score .pill');
    expect(pill?.getAttribute('aria-label')).toMatch(
      /^redundancy score \d+ of 100, (clean|mostly clean|some redundancy|notable redundancy|severe)$/,
    );
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
