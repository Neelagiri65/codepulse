import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(__dirname, '..');
const readJSON = (relativePath: string): unknown => {
  const abs = resolve(repoRoot, relativePath);
  return JSON.parse(readFileSync(abs, 'utf8'));
};

describe('scaffold — static data skeletons', () => {
  it('data/catalogue.json exists with {version, patterns[]}', () => {
    const data = readJSON('data/catalogue.json') as Record<string, unknown>;
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('patterns');
    expect(Array.isArray(data.patterns)).toBe(true);
  });

  it('data/repos.json exists with {refreshed_at, repos[]}', () => {
    const data = readJSON('data/repos.json') as Record<string, unknown>;
    expect(data).toHaveProperty('refreshed_at');
    expect(data).toHaveProperty('repos');
    expect(Array.isArray(data.repos)).toBe(true);
  });

  it('data/meta.json exists with {tool_version, catalogue_version, last_refresh_at}', () => {
    const data = readJSON('data/meta.json') as Record<string, unknown>;
    expect(data).toHaveProperty('tool_version');
    expect(data).toHaveProperty('catalogue_version');
    expect(data).toHaveProperty('last_refresh_at');
  });
});

describe('scaffold — entrypoints', () => {
  it('index.html exists at repo root', () => {
    expect(existsSync(resolve(repoRoot, 'index.html'))).toBe(true);
  });

  it('src/main.ts exists', () => {
    expect(existsSync(resolve(repoRoot, 'src/main.ts'))).toBe(true);
  });
});
