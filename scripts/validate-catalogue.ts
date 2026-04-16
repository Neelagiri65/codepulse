import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Pattern } from '../src/score';

export interface RawCatalogue {
  version: number;
  updated_at: string | null;
  patterns: Pattern[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T.*)?$/;
const VALID_MATCH_TYPES = new Set(['phrase', 'regex']);

const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

const validateEntry = (raw: unknown, index: number, seen: Set<string>): string[] => {
  const errs: string[] = [];
  const where = `patterns[${index}]`;

  if (!isRecord(raw)) {
    return [`${where}: must be an object`];
  }

  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    errs.push(`${where}: id must be a non-empty string`);
  } else if (seen.has(raw.id)) {
    errs.push(`${where}: duplicate id "${raw.id}"`);
  } else {
    seen.add(raw.id);
  }

  if (typeof raw.match_type !== 'string' || !VALID_MATCH_TYPES.has(raw.match_type)) {
    errs.push(`${where}: match_type must be "phrase" or "regex"`);
  }

  if (typeof raw.match_value !== 'string' || raw.match_value.length === 0) {
    errs.push(`${where}: match_value must be a non-empty string`);
  } else if (raw.match_type === 'regex') {
    try {
      new RegExp(raw.match_value);
    } catch {
      errs.push(`${where}: match_value is not a compilable regex`);
    }
  }

  if (
    typeof raw.weight !== 'number' ||
    !Number.isInteger(raw.weight) ||
    raw.weight < 1 ||
    raw.weight > 10
  ) {
    errs.push(`${where}: weight must be an integer 1–10`);
  }

  if (typeof raw.source_url !== 'string' || raw.source_url.length === 0) {
    errs.push(`${where}: source_url must be a non-empty string`);
  } else if (!/^https?:\/\//i.test(raw.source_url)) {
    errs.push(`${where}: source_url must be an http(s) URL`);
  }

  if (typeof raw.reason !== 'string' || raw.reason.trim().length === 0) {
    errs.push(`${where}: reason must be a non-empty string`);
  }

  if (typeof raw.added_at !== 'string' || !ISO_DATE.test(raw.added_at)) {
    errs.push(`${where}: added_at must be an ISO date (YYYY-MM-DD)`);
  }

  if (
    typeof raw.claude_code_version_verified_against !== 'string' ||
    !ISO_DATE.test(raw.claude_code_version_verified_against)
  ) {
    errs.push(
      `${where}: claude_code_version_verified_against must be an ISO date (YYYY-MM-DD)`,
    );
  }

  return errs;
};

export const validateCatalogue = (input: unknown): ValidationResult => {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: ['catalogue: root must be an object'] };
  }

  if (typeof input.version !== 'number') {
    errors.push('catalogue: version must be a number');
  }

  if (!Array.isArray(input.patterns)) {
    errors.push('catalogue: patterns must be an array');
    return { ok: false, errors };
  }

  const seen = new Set<string>();
  input.patterns.forEach((p, i) => {
    errors.push(...validateEntry(p, i, seen));
  });

  return { ok: errors.length === 0, errors };
};

const isDirectInvocation = () =>
  typeof process !== 'undefined' && Array.isArray(process.argv) && process.argv[1]?.endsWith('validate-catalogue.ts');

if (isDirectInvocation()) {
  const path = resolve(process.cwd(), 'data/catalogue.json');
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  const result = validateCatalogue(raw);
  if (result.ok) {
    const count = isRecord(raw) && Array.isArray(raw.patterns) ? raw.patterns.length : 0;
    console.log(`catalogue ok — ${count} entries`);
    process.exit(0);
  } else {
    console.error(`catalogue FAILED — ${result.errors.length} error(s):`);
    for (const err of result.errors) console.error('  ' + err);
    process.exit(1);
  }
}
