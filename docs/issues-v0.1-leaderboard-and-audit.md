# Issues — CodePulse v0.1 Decomposition

Seven issues, ordered by dependency. Each is one session of work, ≤5 files changed, independently testable.

---

## #1 — Repo scaffold (Vite + TS + data layout)

**Goal:** `pnpm dev` serves a placeholder; `pnpm build` emits static output to `dist/`.

**Changes:**
- `package.json`, `tsconfig.json`, `vite.config.ts`
- `index.html` placeholder
- `src/main.ts` with "hello world" mount
- `data/catalogue.json`, `data/repos.json`, `data/meta.json` as empty skeletons with schemas committed
- `.gitignore`, `LICENSE` (AGPL-3.0), `README.md` one-paragraph stub

**Test:** `pnpm build` exits 0; `dist/index.html` exists; three JSON files parse as valid JSON with expected top-level keys.

---

## #2 — Scoring function + unit tests

**Goal:** Pure `score(content, catalogue)` function with deterministic output, no I/O.

**Changes:**
- `src/score.ts` — exports `score()`, types for `Pattern`, `Match`, `Scorecard`
- `src/score.test.ts` — fixtures: empty input, single-match input, all-catalogue-match input, no-match input
- Test runner wired into `package.json` (`vitest`)

**Test:** `pnpm test` green. Coverage ≥90% on `score.ts`. Known input → known output, documented in fixtures.

**Depends on:** #1

---

## #3 — Seed the redundancy catalogue (content work, not code)

**Goal:** `data/catalogue.json` contains 50 real entries, each with a verifiable source.

**Changes:**
- `data/catalogue.json` — 50 entries, strict schema: `{ id, match_type: "phrase"|"regex", match_value, weight: 1–10, source_url, reason, added_at }`
- `scripts/validate-catalogue.ts` — CI check that schema holds and every entry has a non-empty source_url
- Document sourcing rules in `docs/catalogue-authoring.md`: only Anthropic docs, public Piebald catalogue refs, or observed-in-repo with explicit repo URL. No "this seems redundant" without citation.

**Test:** `pnpm validate:catalogue` green. Manual review: every entry's source_url loads and supports the claim. Reject any entry that fails this review.

**Depends on:** #1. Ideally authored by the user (domain knowledge), not by the agent alone.

---

## #4 — Refresh pipeline (GitHub Actions cron)

**Goal:** Hourly job that discovers top 200 repos with `CLAUDE.md`, scores them, writes `data/repos.json`.

**Changes:**
- `scripts/refresh.ts` — uses `@octokit/rest`, calls `score()` from `src/score.ts`, writes JSON
- `.github/workflows/refresh.yml` — cron `0 * * * *`, runs `pnpm refresh`, commits `data/repos.json` + `data/meta.json` to main if changed
- GitHub Actions secret `GH_TOKEN` configured manually (user action)

**Test:** Workflow runs manually via `workflow_dispatch`; `data/repos.json` populates with 200 entries; rate-limit headroom verified (≤~1500 calls per run, well under the 5,000/hr authenticated limit). Second run is idempotent unless source repos changed.

**Note on revised call budget (2026-04-17):** the original `<500` target assumed GitHub code search had a `sort:stars-desc` option. It doesn't, and code-search results don't carry `stargazers_count` inline. A faithful "top 200 by stars" therefore requires: (a) paginated code search to surface CLAUDE.md-bearing repos (~10 calls), (b) a `repos.get` enrichment per unique repo for stars (~500–1000 calls), (c) content + last-commit per winner (200 × 2 = 400). Total ~1000–1400 calls per run. Honest-data rule from the PRD applies: we ship the real API cost rather than shrink the dataset to hit an arbitrary budget.

**Depends on:** #2, #3

---

## #5 — Leaderboard UI

**Goal:** Single-page table rendering `data/repos.json`.

**Changes:**
- `src/leaderboard.ts` — fetch `data/repos.json`, render sortable HTML table
- `src/styles.css` — minimal, no framework
- `index.html` updated to mount both leaderboard and (placeholder) paste-audit

**Test:** Site loads, table renders 200 rows, sortable by score/stars/size, clicking a repo opens its GitHub URL. LCP <2s measured with Lighthouse. No network calls after initial asset load.

**Depends on:** #4 (needs real `repos.json` to render)

---

## #6 — Paste-audit UI

**Goal:** Textarea → score button → rendered scorecard, using the shared `score()` function.

**Changes:**
- `src/audit.ts` — textarea mount, calls `score()` against `data/catalogue.json`
- `src/scorecard.ts` — rendering primitives shared between leaderboard detail view and paste-audit
- `index.html` updated with audit section markup

**Test:** Pasting a known test fixture produces the expected scorecard. Pasting empty input shows an informational state, not an error. Browser console stays clean.

**Depends on:** #2, #3

---

## #7 — Deploy + domain + launch MOM

**Goal:** Live on Vercel, measurable, safe to share.

**Changes:**
- `vercel.json` (if needed — likely nothing beyond default for Vite static)
- `README.md` expanded: what it is, how scoring works, how to reproduce, how to contribute a catalogue entry
- `docs/mom-v0.1.md` — the validation checklist: LCP <2s, zero runtime network calls, leaderboard populated, paste-audit works, three architectural constraint tests pass, data is honest (no recalibration)

**Test:** Deploy succeeds, live URL passes every item in `docs/mom-v0.1.md`. If any item fails, don't announce.

**Depends on:** #5, #6

---

## Dependency graph

```
#1 ─┬─> #2 ─┬─> #4 ─> #5 ─┐
    │       │              ├─> #7
    └─> #3 ─┴─> #6 ────────┘
```

#3 (catalogue authoring) is the critical path and the single biggest lever on product quality. It deserves more care than any of the code issues.
