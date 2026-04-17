import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

// Read the same on-disk data the dev server will serve.
const repos = JSON.parse(
  readFileSync(resolve(here, '../../data/repos.json'), 'utf8'),
) as {
  refreshed_at: string;
  repos: Array<{
    owner: string;
    name: string;
    stars: number;
    char_count: number;
    score: number;
    last_commit_at: string;
    matches: string[];
  }>;
};

const catalogue = JSON.parse(
  readFileSync(resolve(here, '../../data/catalogue.json'), 'utf8'),
) as {
  version: number;
  patterns: Array<{ id: string; match_value: string }>;
};

type Bucket = { label: string; count: number };
const BUCKET_DEFS: Array<{ label: string; range: [number, number] }> = [
  { label: '0', range: [0, 0] },
  { label: '1–25', range: [1, 25] },
  { label: '26–50', range: [26, 50] },
  { label: '51–75', range: [51, 75] },
  { label: '76–100', range: [76, 100] },
];

const computeBuckets = (): Bucket[] =>
  BUCKET_DEFS.map((b) => ({
    label: b.label,
    count: repos.repos.filter((r) => r.score >= b.range[0] && r.score <= b.range[1]).length,
  }));

const computeCleanPct = (): number => {
  const clean = repos.repos.filter((r) => r.score === 0).length;
  return Math.round((clean / repos.repos.length) * 100);
};

const waitForBoot = async (page: Page): Promise<void> => {
  await page.waitForSelector('.hero-headline');
  await page.waitForSelector('.leaderboard-table tbody tr');
  await page.waitForSelector('.audit-textarea');
};

test.describe('CodePulse leaderboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
  });

  test('hero renders repo count and clean percentage', async ({ page }) => {
    const headline = page.locator('.hero-headline');
    await expect(headline).toContainText(`${repos.repos.length.toLocaleString()} CLAUDE.md files measured`);
    await expect(headline.locator('.accent')).toContainText(`${computeCleanPct()}% clean`);
    await expect(page.locator('.wordmark')).toHaveText('CODEPULSE');
  });

  test('confidence caption is visible with pattern count + methodology link', async ({ page }) => {
    const confidence = page.locator('.hero-confidence');
    await expect(confidence).toBeVisible();
    await expect(confidence).toContainText(`Scored against ${catalogue.patterns.length} catalogue patterns`);
    await expect(confidence).toContainText('narrow scan, not a comprehensive audit');
    const link = confidence.locator('.hero-methodology-link');
    await expect(link).toHaveAttribute('href', /catalogue-authoring\.md$/);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('histogram renders correct bucket counts', async ({ page }) => {
    const expected = computeBuckets();
    const cols = page.locator('.histogram-col');
    await expect(cols).toHaveCount(expected.length);
    for (let i = 0; i < expected.length; i++) {
      const col = cols.nth(i);
      await expect(col.locator('.histogram-count')).toHaveText(String(expected[i].count));
      await expect(col.locator('.histogram-label')).toHaveText(expected[i].label);
    }
  });

  test('table renders every repo, score-desc by default with stars tiebreak', async ({ page }) => {
    const rows = page.locator('.leaderboard-table tbody tr');
    await expect(rows).toHaveCount(repos.repos.length);

    const expected = [...repos.repos]
      .sort((a, b) => b.score - a.score || b.stars - a.stars)
      .slice(0, 5)
      .map((r) => `${r.owner}/${r.name}`);
    for (let i = 0; i < expected.length; i++) {
      await expect(rows.nth(i).locator('.col-repo')).toHaveText(expected[i]);
    }

    const scoreHeader = page.locator('th.col-score');
    await expect(scoreHeader).toHaveAttribute('data-sort', 'active');
    await expect(scoreHeader.locator('.sort-indicator')).toHaveText('▼');
  });

  test('clicking Stars header sorts by stars descending, second click flips direction', async ({ page }) => {
    const starsHeader = page.locator('th.col-stars');
    await starsHeader.click();
    await expect(starsHeader).toHaveAttribute('data-sort', 'active');
    await expect(starsHeader.locator('.sort-indicator')).toHaveText('▼');

    const topStars = [...repos.repos].sort((a, b) => b.stars - a.stars)[0];
    await expect(page.locator('.leaderboard-table tbody tr').first().locator('.col-repo')).toHaveText(
      `${topStars.owner}/${topStars.name}`,
    );

    await starsHeader.click();
    await expect(starsHeader.locator('.sort-indicator')).toHaveText('▲');
    const bottomStars = [...repos.repos].sort((a, b) => a.stars - b.stars)[0];
    await expect(page.locator('.leaderboard-table tbody tr').first().locator('.col-repo')).toHaveText(
      `${bottomStars.owner}/${bottomStars.name}`,
    );
  });

  test('Chars header and Updated header are clickable sort keys', async ({ page }) => {
    const charsHeader = page.locator('th.col-chars');
    await charsHeader.click();
    await expect(charsHeader).toHaveAttribute('data-sort', 'active');
    const topChars = [...repos.repos].sort((a, b) => b.char_count - a.char_count)[0];
    await expect(page.locator('.leaderboard-table tbody tr').first().locator('.col-repo')).toHaveText(
      `${topChars.owner}/${topChars.name}`,
    );

    const updatedHeader = page.locator('th.col-last-commit');
    await updatedHeader.click();
    await expect(updatedHeader).toHaveAttribute('data-sort', 'active');
    const mostRecent = [...repos.repos].sort(
      (a, b) => new Date(b.last_commit_at).getTime() - new Date(a.last_commit_at).getTime(),
    )[0];
    await expect(page.locator('.leaderboard-table tbody tr').first().locator('.col-repo')).toHaveText(
      `${mostRecent.owner}/${mostRecent.name}`,
    );
  });

  test('row click opens the correct GitHub repo URL', async ({ page, context }) => {
    const firstRow = page.locator('.leaderboard-table tbody tr').first();
    const expectedUrl = await firstRow.getAttribute('data-url');
    expect(expectedUrl).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    const popupPromise = context.waitForEvent('page');
    await firstRow.locator('.col-repo').click();
    const popup = await popupPromise;
    expect(popup.url()).toBe(expectedUrl);
    await popup.close();
  });

  test('footer shows catalogue version + pattern count', async ({ page }) => {
    const footer = page.locator('.footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(`catalogue v${catalogue.version}`);
    await expect(footer).toContainText(`${catalogue.patterns.length} patterns`);
    await expect(footer).toContainText('scoring deterministic');
  });
});

test.describe('Paste audit', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForBoot(page);
  });

  test('empty state shows placeholder', async ({ page }) => {
    await expect(page.locator('.scorecard-empty')).toBeVisible();
    await expect(page.locator('.scorecard-empty')).toContainText(
      'Paste a CLAUDE.md to score it against the catalogue.',
    );
  });

  test('pasting a redundant config produces a non-zero score with matched patterns', async ({ page }) => {
    const redundant = [
      '# My project',
      '- Be concise.',
      '- Prefer editing existing files to creating new ones.',
      '- No emojis in commit messages.',
    ].join('\n');
    await page.locator('.audit-textarea').fill(redundant);

    await expect(page.locator('.scorecard')).toBeVisible();
    const pill = page.locator('.scorecard .pill-lg');
    await expect(pill).toBeVisible();
    const pillText = (await pill.textContent())?.trim() ?? '';
    expect(Number(pillText)).toBeGreaterThan(0);

    const matchList = page.locator('.scorecard .match-list .match-item');
    await expect(matchList).not.toHaveCount(0);
    const ids = await page.locator('.scorecard .match-id').allTextContents();
    expect(ids).toEqual(expect.arrayContaining(['be-concise', 'prefer-editing']));

    await expect(page.locator('.audit-meta')).toContainText('chars');
    await expect(page.locator('.audit-meta')).toContainText('tokens (approx)');
  });

  test('pasting a clean config shows score 0 and clean message', async ({ page }) => {
    const clean = 'This is a project-specific rule: use the Widget class from lib/widget.ts. Nothing generic here.';
    await page.locator('.audit-textarea').fill(clean);

    const pill = page.locator('.scorecard .pill-lg');
    await expect(pill).toHaveText('0');
    await expect(page.locator('.scorecard-clean')).toBeVisible();
    await expect(page.locator('.scorecard-clean')).toContainText('No catalogued redundancy patterns matched');
  });
});

test.describe('Responsive widths', () => {
  for (const width of [375, 768, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await waitForBoot(page);
      const overflow = await page.evaluate(() => ({
        bodyScroll: document.documentElement.scrollWidth,
        bodyClient: document.documentElement.clientWidth,
      }));
      expect(overflow.bodyScroll).toBeLessThanOrEqual(overflow.bodyClient + 1);

      const scroller = page.locator('.leaderboard-scroll');
      await expect(scroller).toBeVisible();
      const { canScroll } = await scroller.evaluate((el) => ({
        canScroll: el.scrollWidth >= el.clientWidth,
      }));
      expect(canScroll).toBe(true);
    });
  }
});

test.describe('Performance', () => {
  test('largest contentful paint under 2 seconds', async ({ page }) => {
    await page.goto('/');
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let last = 0;
          const po = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              last = entry.startTime;
            }
          });
          po.observe({ type: 'largest-contentful-paint', buffered: true });
          // Settle briefly, then resolve with the last LCP value seen.
          setTimeout(() => {
            po.disconnect();
            resolve(last);
          }, 500);
        }),
    );
    expect(lcp).toBeGreaterThan(0);
    expect(lcp).toBeLessThan(2000);
  });
});
