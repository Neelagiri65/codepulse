export interface Pattern {
  id: string;
  match_type: 'phrase' | 'regex';
  match_value: string;
  weight: number;
  source_url: string;
  reason: string;
  added_at: string;
  claude_code_version_verified_against: string;
}

export interface Match {
  patternId: string;
  excerpt: string;
  weight: number;
}

export interface Scorecard {
  redundancyScore: number;
  matches: Match[];
  tokenCost: number;
  skipped: string[];
}

const EXCERPT_RADIUS = 40;

const excerptAround = (content: string, index: number, hitLength: number): string => {
  const start = Math.max(0, index - EXCERPT_RADIUS);
  const end = Math.min(content.length, index + hitLength + EXCERPT_RADIUS);
  return content.slice(start, end).replace(/\s+/g, ' ').trim();
};

const findFirstHit = (
  content: string,
  pattern: Pattern,
): { index: number; length: number } | null => {
  if (pattern.match_type === 'phrase') {
    const index = content.indexOf(pattern.match_value);
    if (index === -1) return null;
    return { index, length: pattern.match_value.length };
  }
  const re = new RegExp(pattern.match_value);
  const m = re.exec(content);
  if (!m) return null;
  return { index: m.index, length: m[0].length };
};

export const score = (content: string, catalogue: Pattern[]): Scorecard => {
  const matches: Match[] = [];
  const skipped: string[] = [];
  let matchedWeight = 0;
  let totalWeight = 0;

  for (const pattern of catalogue) {
    totalWeight += pattern.weight;

    let hit: { index: number; length: number } | null;
    try {
      hit = findFirstHit(content, pattern);
    } catch {
      skipped.push(pattern.id);
      continue;
    }

    if (hit === null) continue;

    matches.push({
      patternId: pattern.id,
      excerpt: excerptAround(content, hit.index, hit.length),
      weight: pattern.weight,
    });
    matchedWeight += pattern.weight;
  }

  const redundancyScore =
    totalWeight === 0 ? 0 : Math.round((matchedWeight / totalWeight) * 100);

  return {
    redundancyScore,
    matches,
    tokenCost: Math.ceil(content.length / 4),
    skipped,
  };
};
