import './styles.css';
import reposData from '../data/repos.json';
import catalogueData from '../data/catalogue.json';
import { mountLeaderboard, type CatalogueCoverage, type ReposFile } from './leaderboard';
import { mountAudit, type CatalogueFile } from './audit';

const METHODOLOGY_URL =
  'https://github.com/Neelagiri65/codepulse/blob/main/docs/catalogue-authoring.md';

const renderFooter = (catalogue: CatalogueFile): HTMLElement => {
  const footer = document.createElement('footer');
  footer.className = 'footer';
  footer.textContent = `catalogue v${catalogue.version} · ${catalogue.patterns.length} patterns · scoring deterministic · source github.com/Neelagiri65/codepulse`;
  return footer;
};

const boot = (): void => {
  const root = document.getElementById('app');
  if (!root) return;

  const repos = reposData as ReposFile;
  const catalogue = catalogueData as CatalogueFile;
  const coverage: CatalogueCoverage = {
    version: catalogue.version,
    patternCount: catalogue.patterns.length,
    methodologyUrl: METHODOLOGY_URL,
  };

  const page = document.createElement('div');
  page.className = 'page';

  const leaderboardMount = document.createElement('div');
  leaderboardMount.id = 'leaderboard';
  page.appendChild(leaderboardMount);
  mountLeaderboard(leaderboardMount, repos, coverage);

  const auditMount = document.createElement('div');
  auditMount.id = 'audit';
  auditMount.className = 'section';
  page.appendChild(auditMount);
  mountAudit(auditMount, catalogue);

  page.appendChild(renderFooter(catalogue));

  root.replaceChildren(page);
};

boot();
