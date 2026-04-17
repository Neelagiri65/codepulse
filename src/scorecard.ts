import type { Pattern, Scorecard } from './score';
import { bucketForScore, healthToken } from './format';

export const renderScorePill = (score: number, size: 'md' | 'lg' = 'md'): HTMLElement => {
  const b = bucketForScore(score);
  const pill = document.createElement('span');
  pill.className = size === 'lg' ? 'pill pill-lg' : 'pill';
  pill.style.setProperty('--pill-colour', healthToken(b));
  pill.textContent = String(score);
  pill.setAttribute('aria-label', ariaForScore(score, b));
  return pill;
};

const BUCKET_WORDS = ['clean', 'mostly clean', 'some redundancy', 'notable redundancy', 'severe'];
const ariaForScore = (score: number, bucket: number): string =>
  `redundancy score ${score} of 100, ${BUCKET_WORDS[bucket]}`;

export const renderPasteScorecard = (
  scorecard: Scorecard,
  catalogue: Pattern[],
): HTMLElement => {
  const root = document.createElement('div');
  root.className = 'scorecard';

  const head = document.createElement('div');
  head.className = 'scorecard-head';
  head.appendChild(renderScorePill(scorecard.redundancyScore, 'lg'));

  const summary = document.createElement('div');
  summary.className = 'scorecard-summary';
  const tokenLabel = document.createElement('span');
  tokenLabel.className = 'label';
  tokenLabel.textContent = 'Token cost';
  const tokenValue = document.createElement('span');
  tokenValue.className = 'value';
  tokenValue.textContent = `${scorecard.tokenCost.toLocaleString()} tokens`;
  const matchLabel = document.createElement('span');
  matchLabel.className = 'label';
  matchLabel.textContent = 'Matched patterns';
  const matchValue = document.createElement('span');
  matchValue.className = 'value';
  matchValue.textContent = `${scorecard.matches.length} of ${catalogue.length}`;
  summary.append(tokenLabel, tokenValue, matchLabel, matchValue);
  head.appendChild(summary);
  root.appendChild(head);

  if (scorecard.matches.length === 0) {
    const clean = document.createElement('p');
    clean.className = 'scorecard-clean';
    clean.innerHTML =
      '<strong>No catalogued redundancy patterns matched.</strong> This config is clean against the current catalogue — all 40 patterns had zero hits.';
    root.appendChild(clean);
    return root;
  }

  const byId = new Map(catalogue.map((p) => [p.id, p] as const));
  const list = document.createElement('ul');
  list.className = 'match-list';
  for (const m of scorecard.matches) {
    const pattern = byId.get(m.patternId);
    const item = document.createElement('li');
    item.className = 'match-item';

    const row = document.createElement('div');
    row.className = 'match-row';

    const id = document.createElement('span');
    id.className = 'match-id';
    id.textContent = m.patternId;

    const weight = document.createElement('span');
    weight.className = 'weight-pill';
    weight.textContent = `w${m.weight}`;

    row.append(id, weight);

    if (pattern?.source_url) {
      const link = document.createElement('a');
      link.className = 'match-link';
      link.href = pattern.source_url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'source ↗';
      row.appendChild(link);
    }

    item.appendChild(row);

    const excerpt = document.createElement('p');
    excerpt.className = 'match-excerpt';
    excerpt.textContent = m.excerpt;
    item.appendChild(excerpt);

    list.appendChild(item);
  }
  root.appendChild(list);

  return root;
};
