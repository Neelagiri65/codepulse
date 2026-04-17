/**
 * Dumps a structural view of the rendered DOM to stdout.
 * Development aid for sessions that can't open a browser — not part of the build.
 */
import { Window } from 'happy-dom';
import reposData from '../data/repos.json' with { type: 'json' };
import catalogueData from '../data/catalogue.json' with { type: 'json' };

const window = new Window({ url: 'http://localhost/' });
globalThis.window = window as unknown as typeof globalThis.window;
globalThis.document = window.document as unknown as typeof globalThis.document;
globalThis.HTMLElement = window.HTMLElement as unknown as typeof globalThis.HTMLElement;
globalThis.Event = window.Event as unknown as typeof globalThis.Event;

const { mountLeaderboard } = await import('../src/leaderboard.ts');
const { mountAudit } = await import('../src/audit.ts');

const root = window.document.createElement('div');
window.document.body.appendChild(root as unknown as Node);

mountLeaderboard(root as unknown as HTMLElement, reposData as never);

const auditMount = window.document.createElement('div');
window.document.body.appendChild(auditMount as unknown as Node);
mountAudit(auditMount as unknown as HTMLElement, catalogueData as never);

const text = (sel: string, ctx: Element | Document = window.document as unknown as Document) =>
  (ctx.querySelector(sel) as unknown as HTMLElement | null)?.textContent?.replace(/\s+/g, ' ').trim();

const countOf = (sel: string) => window.document.querySelectorAll(sel).length;

console.log('=== Hero ===');
console.log('wordmark:', text('.wordmark'));
console.log('refreshed:', text('.refreshed'));
console.log('headline:', text('.hero-headline'));
console.log('sub:', text('.hero-sub'));

console.log('\n=== Histogram ===');
const cols = window.document.querySelectorAll('.histogram-col');
cols.forEach((c) => {
  const ce = c as unknown as Element;
  console.log(
    ' ',
    text('.histogram-label', ce)?.padEnd(8),
    text('.histogram-count', ce)?.padStart(4),
    ' bar height=' +
      ((ce.querySelector('.histogram-bar') as unknown as HTMLElement | null)?.style.height ?? '-'),
    ' colour=' +
      ((ce.querySelector('.histogram-bar') as unknown as HTMLElement | null)?.style.getPropertyValue(
        '--bar-colour',
      ) || '(none)'),
  );
});

console.log('\n=== Leaderboard table (first 6 rows) ===');
console.log(
  ['#', 'repo', 'stars', 'chars', 'score', 'updated'].map((s) => s.padEnd(10)).join(' | '),
);
const rows = window.document.querySelectorAll('.leaderboard-table tbody tr');
console.log(`total rows: ${rows.length}`);
Array.from(rows)
  .slice(0, 6)
  .forEach((r) => {
    const re = r as unknown as Element;
    const cells = [
      text('.col-rank', re),
      text('.col-repo', re),
      text('.col-stars', re),
      text('.col-chars', re),
      text('.col-score .pill', re),
      text('.col-last-commit', re),
    ];
    console.log(cells.map((s) => (s ?? '').padEnd(10)).join(' | '));
  });

console.log('\n=== Audit empty state ===');
console.log('textarea placeholder:', (window.document.querySelector('.audit-textarea') as unknown as HTMLTextAreaElement)?.placeholder);
console.log('empty msg:', text('.scorecard-empty'));
console.log('counts row:', text('.audit-meta'));

console.log('\n=== Audit populated state ===');
const ta = window.document.querySelector('.audit-textarea') as unknown as HTMLTextAreaElement;
ta.value =
  'Be concise.\nNo emojis.\nPrefer editing existing files to creating new ones.\nDo not create documentation files.';
ta.dispatchEvent(new window.Event('input') as unknown as Event);
console.log('score:', text('.scorecard .pill'));
console.log('counts row:', text('.audit-meta'));
console.log('matched count:', countOf('.match-item'));
Array.from(window.document.querySelectorAll('.match-item')).forEach((m) => {
  const me = m as unknown as Element;
  console.log(
    ' -',
    text('.match-id', me)?.padEnd(30),
    text('.weight-pill', me)?.padStart(4),
    ' excerpt:',
    text('.match-excerpt', me)?.slice(0, 60),
  );
});

console.log('\n=== Audit clean state ===');
ta.value = 'This project uses the standard conventions of the framework.';
ta.dispatchEvent(new window.Event('input') as unknown as Event);
console.log('score:', text('.scorecard .pill'));
console.log('clean msg:', text('.scorecard-clean'));

process.exit(0);
