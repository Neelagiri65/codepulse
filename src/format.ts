export const formatStars = (n: number): string => {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1)}k`;
};

const DAY_MS = 86_400_000;

export const formatRelativeTime = (iso: string, now: Date = new Date()): string => {
  const then = new Date(iso).getTime();
  const days = Math.floor((now.getTime() - then) / DAY_MS);
  if (days <= 0) return 'today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};

export type Bucket = 0 | 1 | 2 | 3 | 4;

export const bucketForScore = (score: number): Bucket => {
  if (score <= 5) return 0;
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 65) return 3;
  return 4;
};

export const healthToken = (bucket: Bucket): string => `var(--health-${bucket})`;

export interface DistributionBucket {
  label: string;
  range: [number, number];
  count: number;
}

export interface Distribution {
  buckets: DistributionBucket[];
  total: number;
  clean: number;
  cleanPct: number;
  max: number;
  median: number;
}

const LEADERBOARD_BUCKETS: Array<Pick<DistributionBucket, 'label' | 'range'>> = [
  { label: '0', range: [0, 0] },
  { label: '1–25', range: [1, 25] },
  { label: '26–50', range: [26, 50] },
  { label: '51–75', range: [51, 75] },
  { label: '76–100', range: [76, 100] },
];

export const distribution = (scores: number[]): Distribution => {
  const buckets: DistributionBucket[] = LEADERBOARD_BUCKETS.map((b) => ({
    ...b,
    count: scores.filter((s) => s >= b.range[0] && s <= b.range[1]).length,
  }));
  const total = scores.length;
  const clean = buckets[0].count;
  const cleanPct = total === 0 ? 0 : Math.round((clean / total) * 100);
  const max = total === 0 ? 0 : Math.max(...scores);
  const sorted = [...scores].sort((a, b) => a - b);
  const median =
    total === 0
      ? 0
      : total % 2 === 1
        ? sorted[(total - 1) / 2]
        : Math.round((sorted[total / 2 - 1] + sorted[total / 2]) / 2);
  return { buckets, total, clean, cleanPct, max, median };
};
