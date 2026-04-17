import './styles.css';
import reposData from '../data/repos.json';
import catalogueData from '../data/catalogue.json';
import { mountLeaderboard, type ReposFile } from './leaderboard';
import { mountAudit, type CatalogueFile } from './audit';

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

  const page = document.createElement('div');
  page.className = 'page';

  const leaderboardMount = document.createElement('div');
  leaderboardMount.id = 'leaderboard';
  page.appendChild(leaderboardMount);
  mountLeaderboard(leaderboardMount, repos);

  const auditMount = document.createElement('div');
  auditMount.id = 'audit';
  auditMount.className = 'section';
  page.appendChild(auditMount);
  mountAudit(auditMount, catalogue);

  page.appendChild(renderFooter(catalogue));

  root.replaceChildren(page);
};

boot();
