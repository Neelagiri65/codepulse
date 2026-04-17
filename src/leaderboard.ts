import {
  distribution,
  formatRelativeTime,
  formatStars,
  healthToken,
  type Distribution,
} from './format';
import { renderScorePill } from './scorecard';

export interface RepoRow {
  owner: string;
  name: string;
  stars: number;
  char_count: number;
  score: number;
  last_commit_at: string;
  matches: string[];
}

export interface ReposFile {
  refreshed_at: string;
  repos: RepoRow[];
}

export interface CatalogueCoverage {
  version: number;
  patternCount: number;
  methodologyUrl: string;
}

type SortKey = 'rank' | 'stars' | 'chars' | 'score' | 'last_commit';
type SortDir = 'asc' | 'desc';

const formatIsoZulu = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}Z`;
};

export const renderHero = (
  data: ReposFile,
  dist: Distribution,
  coverage: CatalogueCoverage,
): HTMLElement => {
  const hero = document.createElement('section');
  hero.className = 'hero';

  const top = document.createElement('div');
  top.className = 'hero-top';

  const word = document.createElement('span');
  word.className = 'wordmark';
  word.textContent = 'CODEPULSE';

  const refreshed = document.createElement('span');
  refreshed.className = 'refreshed';
  const dot = document.createElement('span');
  dot.className = 'refreshed-dot';
  dot.setAttribute('aria-hidden', 'true');
  const when = document.createElement('span');
  when.textContent = `refreshed ${formatIsoZulu(data.refreshed_at)}`;
  refreshed.append(dot, when);

  top.append(word, refreshed);

  const headline = document.createElement('h1');
  headline.className = 'hero-headline';
  const n = dist.total.toLocaleString();
  headline.innerHTML = `${n} CLAUDE.md files measured · <span class="accent">${dist.cleanPct}% clean</span>`;

  const sub = document.createElement('p');
  sub.className = 'hero-sub';
  sub.textContent = `median redundancy ${dist.median} · max ${dist.max} · catalogue v${coverage.version}`;

  const confidence = document.createElement('p');
  confidence.className = 'hero-confidence';
  const lead = document.createElement('span');
  lead.textContent = `Scored against ${coverage.patternCount} catalogue patterns — narrow scan, not a comprehensive audit. `;
  const link = document.createElement('a');
  link.className = 'hero-methodology-link';
  link.href = coverage.methodologyUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Methodology →';
  confidence.append(lead, link);

  hero.append(top, headline, sub, confidence);
  return hero;
};

export const renderHistogram = (dist: Distribution): HTMLElement => {
  const root = document.createElement('section');
  root.className = 'histogram';

  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = 'Distribution';

  const caption = document.createElement('p');
  caption.className = 'histogram-caption';
  caption.textContent = 'Redundancy score — lower is better. Each bar is a score bucket.';

  const chart = document.createElement('div');
  chart.className = 'histogram-chart';

  const maxCount = Math.max(...dist.buckets.map((b) => b.count), 1);

  dist.buckets.forEach((b, i) => {
    const col = document.createElement('div');
    col.className = 'histogram-col';

    const count = document.createElement('span');
    count.className = 'histogram-count';
    count.textContent = String(b.count);

    const frame = document.createElement('div');
    frame.className = 'histogram-bar-frame';
    frame.setAttribute('role', 'img');
    frame.setAttribute('aria-label', `${b.count} repos scored ${b.label}`);

    const bar = document.createElement('div');
    bar.className = 'histogram-bar';
    const pct = b.count === 0 ? 0 : (b.count / maxCount) * 100;
    bar.style.height = `${pct}%`;
    if (b.count > 0) {
      bar.style.setProperty('--bar-colour', healthToken(i as 0 | 1 | 2 | 3 | 4));
    }
    frame.appendChild(bar);

    const label = document.createElement('span');
    label.className = 'histogram-label';
    label.textContent = b.label;

    col.append(count, frame, label);
    chart.appendChild(col);
  });

  root.append(title, caption, chart);
  return root;
};

const renderMatches = (matches: string[]): HTMLElement => {
  const wrap = document.createElement('span');
  if (matches.length === 0) {
    wrap.textContent = '—';
    wrap.style.color = 'var(--fg-3)';
    return wrap;
  }
  const shown = matches.slice(0, 3);
  shown.forEach((m, i) => {
    const id = document.createElement('span');
    id.textContent = m;
    wrap.appendChild(id);
    if (i < shown.length - 1) {
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.textContent = '·';
      wrap.appendChild(dot);
    }
  });
  if (matches.length > 3) {
    const more = document.createElement('span');
    more.className = 'more';
    more.textContent = ` +${matches.length - 3} more`;
    wrap.appendChild(more);
  }
  return wrap;
};

const compareRows = (a: RepoRow, b: RepoRow, key: SortKey, dir: SortDir): number => {
  const sign = dir === 'asc' ? 1 : -1;
  switch (key) {
    case 'stars':
      return sign * (a.stars - b.stars);
    case 'chars':
      return sign * (a.char_count - b.char_count);
    case 'score':
      return sign * (a.score - b.score);
    case 'last_commit':
      return sign * (new Date(a.last_commit_at).getTime() - new Date(b.last_commit_at).getTime());
    case 'rank':
    default:
      return 0;
  }
};

interface State {
  sortKey: SortKey;
  sortDir: SortDir;
  rows: RepoRow[];
  rankByRepo: Map<string, number>;
}

const DEFAULT_SORT: { key: SortKey; dir: SortDir } = { key: 'score', dir: 'desc' };

const SORT_HEADERS: Array<{ key: SortKey | null; label: string; className: string }> = [
  { key: null, label: '#', className: 'col-rank' },
  { key: null, label: 'Repository', className: 'col-repo' },
  { key: 'stars', label: 'Stars', className: 'col-stars' },
  { key: 'chars', label: 'Chars', className: 'col-chars' },
  { key: 'score', label: 'Score', className: 'col-score' },
  { key: null, label: 'Matches', className: 'col-matches' },
  { key: 'last_commit', label: 'Updated', className: 'col-last-commit' },
];

const renderTable = (state: State): HTMLElement => {
  const table = document.createElement('table');
  table.className = 'leaderboard-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  SORT_HEADERS.forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h.label;
    th.className = h.className;
    if (h.key) {
      th.dataset.sortKey = h.key;
      if (h.key === state.sortKey) {
        th.dataset.sort = 'active';
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.textContent = state.sortDir === 'asc' ? '▲' : '▼';
        th.appendChild(indicator);
      }
    } else {
      th.style.cursor = 'default';
    }
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  state.rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.dataset.url = `https://github.com/${r.owner}/${r.name}`;

    const rank = document.createElement('td');
    rank.className = 'col-rank';
    const rankNum = state.rankByRepo.get(`${r.owner}/${r.name}`) ?? 0;
    rank.textContent = String(rankNum);

    const repo = document.createElement('td');
    repo.className = 'col-repo';
    repo.textContent = `${r.owner}/${r.name}`;
    repo.title = `${r.owner}/${r.name}`;

    const stars = document.createElement('td');
    stars.className = 'col-stars';
    stars.textContent = formatStars(r.stars);

    const chars = document.createElement('td');
    chars.className = 'col-chars';
    chars.textContent = r.char_count.toLocaleString();

    const score = document.createElement('td');
    score.className = 'col-score';
    score.appendChild(renderScorePill(r.score));

    const matches = document.createElement('td');
    matches.className = 'col-matches';
    matches.appendChild(renderMatches(r.matches));

    const last = document.createElement('td');
    last.className = 'col-last-commit';
    last.textContent = formatRelativeTime(r.last_commit_at);

    tr.append(rank, repo, stars, chars, score, matches, last);
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);
  return table;
};

export const mountLeaderboard = (
  mount: HTMLElement,
  data: ReposFile,
  coverage: CatalogueCoverage,
): void => {
  mount.innerHTML = '';

  const dist = distribution(data.repos.map((r) => r.score));

  mount.appendChild(renderHero(data, dist, coverage));

  const grid = document.createElement('div');
  grid.className = 'data-grid section';

  const histogram = renderHistogram(dist);
  grid.appendChild(histogram);

  const board = document.createElement('section');
  board.className = 'leaderboard';

  const boardHeader = document.createElement('div');
  boardHeader.style.padding = 'var(--space-4) var(--space-5)';
  boardHeader.style.borderBottom = '1px solid var(--border)';
  const boardTitle = document.createElement('h2');
  boardTitle.className = 'section-title';
  boardTitle.style.margin = '0';
  boardTitle.textContent = `Ranked · ${data.repos.length} repos`;
  boardHeader.appendChild(boardTitle);
  board.appendChild(boardHeader);

  const rankByRepo = new Map<string, number>();
  [...data.repos]
    .sort((a, b) => b.score - a.score || b.stars - a.stars)
    .forEach((r, i) => rankByRepo.set(`${r.owner}/${r.name}`, i + 1));

  const state: State = {
    sortKey: DEFAULT_SORT.key,
    sortDir: DEFAULT_SORT.dir,
    rows: [...data.repos],
    rankByRepo,
  };
  const applySort = () => {
    state.rows = [...data.repos].sort((a, b) => {
      const primary = compareRows(a, b, state.sortKey, state.sortDir);
      if (primary !== 0) return primary;
      return b.stars - a.stars;
    });
  };
  applySort();

  const scroll = document.createElement('div');
  scroll.className = 'leaderboard-scroll';
  scroll.appendChild(renderTable(state));
  board.appendChild(scroll);

  scroll.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const th = target.closest('th[data-sort-key]') as HTMLElement | null;
    if (th) {
      const key = th.dataset.sortKey as SortKey;
      if (key === state.sortKey) {
        state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortKey = key;
        state.sortDir = 'desc';
      }
      applySort();
      scroll.replaceChildren(renderTable(state));
      return;
    }
    const tr = target.closest('tr') as HTMLTableRowElement | null;
    if (tr?.dataset.url) {
      window.open(tr.dataset.url, '_blank', 'noopener,noreferrer');
    }
  });

  grid.appendChild(board);
  mount.appendChild(grid);
};
