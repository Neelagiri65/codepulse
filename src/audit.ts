import { score, type Pattern } from './score';
import { renderPasteScorecard } from './scorecard';

export interface CatalogueFile {
  version: number;
  updated_at: string;
  patterns: Pattern[];
}

export const mountAudit = (mount: HTMLElement, catalogue: CatalogueFile): void => {
  mount.innerHTML = '';

  const title = document.createElement('h2');
  title.className = 'section-title';
  title.textContent = 'Audit your CLAUDE.md';

  const sub = document.createElement('p');
  sub.className = 'section-sub';
  sub.textContent = `Paste a CLAUDE.md file. It's scored client-side against catalogue v${catalogue.version} (${catalogue.patterns.length} patterns). Nothing leaves the browser.`;

  // PRD §5.3 privacy contract: the paste audit never calls an LLM, so it
  // is narrower than the leaderboard. The label must make this obvious.
  const semanticNote = document.createElement('p');
  semanticNote.className = 'audit-semantic-note';
  semanticNote.textContent =
    'Note: pasted audits use the deterministic catalogue only; leaderboard scores also include daily semantic enrichment.';

  const grid = document.createElement('div');
  grid.className = 'audit';

  const left = document.createElement('div');
  left.className = 'audit-pane';

  const textarea = document.createElement('textarea');
  textarea.className = 'audit-textarea';
  textarea.placeholder = 'Paste your CLAUDE.md here…';
  textarea.spellcheck = false;

  const meta = document.createElement('div');
  meta.className = 'audit-meta';
  const charsLabel = document.createElement('span');
  charsLabel.innerHTML = '<strong>0</strong> chars';
  const tokensLabel = document.createElement('span');
  tokensLabel.innerHTML = '<strong>0</strong> tokens (approx)';
  meta.append(charsLabel, tokensLabel);

  left.append(textarea, meta);

  const right = document.createElement('div');
  right.className = 'audit-pane';
  const scorecardMount = document.createElement('div');
  scorecardMount.innerHTML =
    '<p class="scorecard-empty">Paste a CLAUDE.md to score it against the catalogue.</p>';
  right.appendChild(scorecardMount);

  grid.append(left, right);

  mount.append(title, sub, semanticNote, grid);

  const update = () => {
    const content = textarea.value;
    const chars = content.length;
    charsLabel.innerHTML = `<strong>${chars.toLocaleString()}</strong> chars`;

    if (chars === 0) {
      tokensLabel.innerHTML = '<strong>0</strong> tokens (approx)';
      scorecardMount.innerHTML =
        '<p class="scorecard-empty">Paste a CLAUDE.md to score it against the catalogue.</p>';
      return;
    }

    const result = score(content, catalogue.patterns);
    tokensLabel.innerHTML = `<strong>${result.tokenCost.toLocaleString()}</strong> tokens (approx)`;
    scorecardMount.replaceChildren(renderPasteScorecard(result, catalogue.patterns));
  };

  textarea.addEventListener('input', update);
};
