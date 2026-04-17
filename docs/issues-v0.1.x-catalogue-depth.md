# Issues — CodePulse v0.1.x: Catalogue Depth

Five issues that take the catalogue from 40 → 150+ entries with credibility preserved, then add the CI-only LLM enrichment layer the PRD v0.1.x amendment now allows. Launch (Issue #7) stays paused behind this work.

**North star:** the session-7 assessment — "the scoring engine is accurate against its catalogue; the catalogue is insufficient." Pipeline and UI are not the bottleneck. The intelligence layer is.

**Immediate target:** 150 entries across sessions #8 and #9.
**Eventual target:** 300–400 entries (post-launch continuous authoring).

---

## #8 — Catalogue expansion, batch A (50 new entries)

**Goal:** `data/catalogue.json` grows from 40 → ~90 entries. Each new entry meets the session-5 credibility bar: verifiable source, no over-match, "hardening ≠ redundancy" respected.

**Methodology (locked, do not shortcut):**
1. **Stratified sampling.** Pull 10 real `CLAUDE.md` files from current `data/repos.json`: 4 from bucket 1–25 (where signal exists), 6 from bucket 0 (where patterns likely lurk un-caught). Use `scripts/sample-claude-mds.mts` (added in this PR) to fetch via `gh api` to `/tmp/codepulse-samples-v0.1.x/`.
2. **Extraction pass.** Read each file line-by-line. Flag any instruction that restates a documented Claude Code default, Piebald system-prompt directive, or Anthropic best-practices assertion. Record: line text verbatim, proposed `match_value`, candidate `source_url`, `reason`, proposed `weight` (1–10).
3. **Dedup + generalise.** Collapse near-duplicates into regex where possible. Avoid over-specific literal phrases that only match the file they came from.
4. **Over-match gate (NON-NEGOTIABLE).** For each proposed pattern, run it against 3 clean-bucket files. If it fires on non-redundant prose, either tighten the regex or drop the pattern. Record the over-match-gate result in a comment during review.
5. **Hardening-≠-redundancy gate.** If the pattern targets destructive-op guards, security claims, or "be careful with X" instructions, verify the instruction is no stricter than Claude Code's documented default. If it's strictness-on-top-of-default, reject.
6. **Validator.** `pnpm validate:catalogue` must pass after each batch commit. Never leave an invalid state on disk.

**Changes:**
- `data/catalogue.json` — 50 new entries merged with existing 40 (total ~90). `version: 2 → 3`, `updated_at` bumped.
- `docs/catalogue-authoring.md` — cross-reference the new methodology section in this doc if the existing checklist needs wording adjustments.

**Acceptance criteria:**
- [ ] 50 new entries, each with a source_url that loads and supports the claim under manual review.
- [ ] Each new entry has passed the over-match gate (demonstrated by running `scripts/smoke-test.mts` against `/tmp/codepulse-samples-v0.1.x/` and inspecting hits for reasonableness).
- [ ] No new entry violates the hardening-≠-redundancy rule.
- [ ] `pnpm validate:catalogue` green; `pnpm test` green; `pnpm typecheck` green.
- [ ] Commit sequence is TDD-aligned where applicable (e.g., validator schema bumps), and semantic elsewhere (content adds as `content: catalogue batch A` commits).

**Depends on:** v0.1 merged (already true — PR #5 merged at `64c5c60`).

---

## #9 — Catalogue expansion, batch B (60 new entries) + LLM enrichment scope-lock

**Goal:** catalogue reaches 150+ entries. LLM enrichment scope is fully specified and a crawl is scheduled to test whether the expansion moved the distribution.

**Changes:**
- `data/catalogue.json` — 60 new entries (cumulative ~150). `version: 3 → 4`.
- `docs/llm-enrichment-v0.1.x.md` — operational spec for the CI-only LLM pass: prompt template, output schema, token budget per repo, error/fallback behaviour, secret management. Issue #10 implements it; this doc locks the shape.
- Re-run `workflow_dispatch` on the refresh Action after catalogue v4 lands. Capture the new distribution in the session handoff:
  - If cleanPct drops meaningfully (e.g., 96 → 70), the expansion worked — catalogue *was* the bottleneck.
  - If cleanPct stays flat, the top-of-ecosystem is genuinely clean and the thesis needs rewriting, not the instrument. Either outcome is shippable per PRD honest-data rule.

**Acceptance criteria:**
- [ ] 60 additional entries meeting the same methodology as #8.
- [ ] Full catalogue of ~150 entries passes validator + a full smoke-test pass against 20 stratified files (5 per bucket × 4 buckets with signal).
- [ ] `docs/llm-enrichment-v0.1.x.md` committed with: prompt template (draft), output schema (draft), per-run cost estimate (daily × ~200 repos), fallback behaviour if API unavailable.
- [ ] Fresh `workflow_dispatch` run on main after v4 merge produces updated `repos.json`; distribution shift (or flatness) captured in next session's handoff.

**Depends on:** #8.

---

## #10 — CI-only LLM enrichment in the refresh Action

**Goal:** daily refresh Action calls Claude to score each repo's `CLAUDE.md` semantically; result cached into `repos.json` alongside deterministic score.

**Changes:**
- `scripts/refresh.ts` — add `enrichSemanticScore(content, catalogue) → Promise<{score, matched_intents}>` that calls the Claude API. Pure wrapper around the SDK; gated behind `process.env.ANTHROPIC_API_KEY`; returns the deterministic score unchanged if key is absent (local dev and reproducibility).
- `scripts/refresh.test.ts` — add tests with a mocked Anthropic client. Verify deterministic score is preserved on API failure; verify cache fields land in `repos.json`.
- `.github/workflows/refresh.yml` — split into two jobs: `deterministic` (hourly, existing) and `semantic` (daily on cron `0 6 * * *`, reads latest `repos.json`, enriches, writes `semantic_score` + `semantic_refreshed_at` per repo, commits).
- `.github/workflows/refresh.yml` — add `ANTHROPIC_API_KEY` secret read for the semantic job; no change for the deterministic job.
- `repos.json` schema — add optional `semantic_score: number | null` and `semantic_refreshed_at: string | null` fields per repo. Existing consumers (leaderboard, scaffold tests) must tolerate missing fields until the first semantic run.
- `src/leaderboard.ts` — display the blended score (deterministic + semantic if present) in the pill; both raw fields remain inspectable via a detail tooltip. Pill colour still tracks the *displayed* bucket.
- `src/audit.ts` — UI label on the paste-audit scorecard: "pasted audits use the deterministic catalogue; leaderboard scores also include daily semantic enrichment." This label is **mandatory** per the PRD v0.1.x amendment.

**Acceptance criteria:**
- [ ] Semantic job runs end-to-end on a `workflow_dispatch` smoke test; `repos.json` shows `semantic_score` populated for all repos; second run is idempotent (writes only if fields change).
- [ ] Deterministic job unchanged — still hourly, still identical output if API key is absent.
- [ ] Unit tests green, including failure-mode tests (API 429, API 5xx, malformed response).
- [ ] Paste-audit UI label is present and legible per DESIGN.md §5.6 rules.
- [ ] Cost estimate validated from real billing: ≤ $5/day at steady state. If higher, escalate scope (model choice, batch API, cadence).

**Depends on:** #9 (semantic spec locked first).

---

## #11 — Scoring-layer asymmetry doc + self-audit

**Goal:** write the launch narrative against real data, including the honest note on scoring asymmetry (paste-audit is deterministic-only, leaderboard is blended).

**Changes:**
- `docs/scoring-methodology.md` — reader-facing explanation: what the catalogue contains, what it misses, why LLM enrichment exists, why the paste-audit stays deterministic. Links from `hero-methodology-link` will point here once it's a better fit than `catalogue-authoring.md`.
- Paste CodePulse's own `CLAUDE.md` into the audit tool; capture the deterministic score. Paste the same file into a local test that runs the LLM enrichment; capture the semantic score. Record both in `docs/self-audit.md` — this is the launch-post hook.

**Acceptance criteria:**
- [ ] `docs/scoring-methodology.md` explains the asymmetry without hedging.
- [ ] Self-audit numbers recorded; narrative for the launch post drafted.

**Depends on:** #10.

---

## #12 — Unpause Issue #7 (deploy + domain + MOM)

**Goal:** Resume the launch track. Only entered once #8–#11 have shipped and the self-audit data is defensible.

**Changes:** as originally specified in `docs/issues-v0.1-leaderboard-and-audit.md` Issue #7, plus:
- `docs/mom-v0.1.md` — add explicit check items for the v0.1.x scope: paste-audit label present, `semantic_score` populated for all repos, cost-per-day measured vs. estimate, confidence caption live.

**Depends on:** #11.

---

## Dependency graph

```
PR #5 merged ──> #8 ──> #9 ──> #10 ──> #11 ──> #12 (unpause #7)
```

Linear, not parallel. Each depends on the previous landing cleanly.

## What this doc does NOT do

- It doesn't expand the catalogue to 300–400 entries. That's a continuous post-launch activity, not a session goal.
- It doesn't change the paste-audit to call an LLM. Architectural constraint: no API keys in the client.
- It doesn't change the deterministic refresh from hourly. The hourly pipeline is correct for the deterministic layer; the daily cadence is for the semantic layer only.
- It doesn't revisit the UI design language. DESIGN.md is stable; the confidence caption and paste-audit label are the only v0.1.x-mandated additions.
