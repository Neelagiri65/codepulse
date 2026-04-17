# Issues — CodePulse v0.1.x: Catalogue Depth

Five issues that grow the catalogue, add the CI-only LLM enrichment layer the
PRD v0.1.x amendment allows, and unpause launch. Launch (Issue #7) stays
paused behind this work.

**North star (revised 2026-04-17 after catalogue v3 re-crawl + manual check):**
the catalogue *has* saturated at 82 entries. Distribution of the top 185 public
repos at v3 is `[175, 10, 0, 0, 0]` with max score 7. A manual read of 5
zero-scoring large files showed that redundancy is real (zenml contains 5
invisible semantic duplicates of Claude defaults) but cannot be caught by
regex. Three of five sampled large files were genuinely clean. **The intelligence
layer — not more regex — is the product's remaining bottleneck.**

See `docs/ground-truth-2026-04-17.md` for the file-by-file findings that set
the acceptance bar for Issue #10.

**Immediate target:** ship Issue #10 (LLM enrichment) against the ground-truth
fixtures before any further catalogue expansion.
**Issue #9 status:** deferred. Another 60 regex entries will not move the
distribution meaningfully; the v3 data already proved this. #9 may return
post-launch as a continuous-authoring task, but the v0.1.x launch does not
depend on it.
**Eventual target:** 300–400 catalogue entries is no longer a v0.1.x milestone.

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

## #9 — [DEFERRED] Catalogue expansion, batch B (60 new entries) + LLM enrichment scope-lock

**Status:** Deferred post-2026-04-17. The catalogue-v3 re-crawl (82 entries)
already saturated the regex layer at `[175, 10, 0, 0, 0]`. More regex entries
will not move the distribution. The LLM enrichment scope-lock that originally
lived here is folded into Issue #10 itself (see the prompt framing there).
Revisit this issue post-launch as a continuous-authoring task if regex recall
ever becomes the bottleneck again.

**Goal (original, retained for reference):** catalogue reaches 150+ entries. LLM enrichment scope is fully specified and a crawl is scheduled to test whether the expansion moved the distribution.

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

**Goal:** daily refresh Action calls a cost-effective LLM to score each repo's
`CLAUDE.md` semantically; result cached into `repos.json` alongside
deterministic score.

**Model decision (2026-04-18, session 11):** Gemini 2.5 Flash, picked on the
ground-truth fixture. Both Flash and Pro pass the acceptance bar identically
(zenml ≥4/5 + 4 clean files zero HIGH). Flash is ~40% faster and ~4× cheaper
(~$0.024 vs ~$0.098 per harness run; ~$0.22/day vs ~$0.92/day at steady-state
cron on 185 repos × ~4k tok avg). The prompt is model-agnostic — revisit if
Flash regresses on a future fixture expansion.

**Ground truth (non-negotiable):** the acceptance fixture is
`docs/ground-truth-2026-04-17.md`. It names the 5 specific redundancies the LLM
must flag in `zenml-io/zenml`'s `CLAUDE.md` and the 4 files the LLM must leave
alone (or at most flag with one low-confidence hit). If the prompt over-flags
the clean files, it ships no product — false positives on legitimate
project-specific content (architecture, API tables, build commands) would be
worse than the current null-result state.

**The prompt has one job, phrased exactly this way:**

> For each instruction in this `CLAUDE.md`, answer one question: *Is this
> sentence instructing Claude to do something Claude Code already does by
> default?* If yes, flag it as redundant and quote the sentence. If the
> instruction is project-specific (build commands, architecture, file paths,
> API contracts, domain rules, team conventions that are stricter or different
> from Claude's defaults), do not flag it.

Not *"does this sound like generic advice."* Not *"is this verbose."* The
prompt must anchor on Claude Code's documented default behaviour and ask
whether the sentence duplicates it. The `zenml` file's *"explain why, not
what"* is redundant (Claude already writes why-not-what comments by default);
the `zenml` file's *"Add appropriate error handling"* is **not** redundant
(Claude's default is the opposite — not to over-validate) and must not be
flagged.

**Anti-bloat rules for the prompt:**

- Do not flag sentences that *contradict* a Claude default. That's an override,
  not redundancy.
- Do not flag sentences that are stricter versions of a default (e.g.,
  "never force push"). That's hardening; the v0.1 catalogue already rejects
  these in the regex layer for the same reason.
- Do not flag project-specific content that merely shares vocabulary with a
  Claude default ("commit after every step" is project guidance if the project
  has unusual commit discipline; "explain why, not what in commit messages" is
  redundant because Claude already does this).
- Prefer precision over recall. One false positive on a file like
  `javascript-obfuscator` damages trust more than three missed redundancies in
  a future zenml-like file.

**Changes:**
- `scripts/enrich.ts` — exports `enrichSemanticScore(content, { model, apiKey? }) →
  Promise<{semantic_score, matched_intents: Array<{quote, reason, confidence}>}>`.
  Pure wrapper around `@google/genai`; gated behind `process.env.GEMINI_API_KEY`.
  **Done 2026-04-18 (session 11).**
- `scripts/refresh.ts` — import `enrichSemanticScore`; call per repo inside the
  semantic job only. Preserve deterministic score on API absence/failure.
- `scripts/refresh.test.ts` — unit tests with a mocked Gemini client. Verify
  deterministic score is preserved on API failure; verify cache fields land in
  `repos.json`.
- `scripts/ground-truth.test.ts` — **integration harness, gated on
  `GEMINI_API_KEY`.** Runs the real prompt against all 5 fixture files fetched
  fresh from GitHub. Asserts: (a) zenml flags at least 4 of the 5 documented
  redundancies with matching quotes, (b) each of the 4 clean files produces
  zero high-confidence flags. Parametrised over Flash + Pro. Skipped in CI by
  default; run explicitly before landing the PR and again on any prompt
  iteration. **Done 2026-04-18 (session 11) — both models green.**
- `.github/workflows/refresh.yml` — split into two jobs: `deterministic`
  (hourly, existing) and `semantic` (daily on cron `0 6 * * *`, reads latest
  `repos.json`, enriches, writes `semantic_score` + `semantic_matched_intents`
  + `semantic_refreshed_at` per repo, commits).
- `.github/workflows/refresh.yml` — add `GEMINI_API_KEY` secret read for the
  semantic job; no change for the deterministic job.
- `repos.json` schema — add optional `semantic_score: number | null`,
  `semantic_matched_intents: Array<{quote, reason}> | null`, and
  `semantic_refreshed_at: string | null` fields per repo. Existing consumers
  (leaderboard, scaffold tests) must tolerate missing fields until the first
  semantic run.
- `src/leaderboard.ts` — display the blended score (deterministic + semantic
  if present) in the pill; both raw fields remain inspectable via a detail
  tooltip. Pill colour still tracks the *displayed* bucket.
- `src/audit.ts` — UI label on the paste-audit scorecard:
  *"pasted audits use the deterministic catalogue; leaderboard scores also
  include daily semantic enrichment."* Mandatory per the PRD v0.1.x amendment.

**Acceptance criteria:**
- [ ] `scripts/ground-truth.test.ts` passes against the current prompt: zenml
      surfaces ≥4 of the 5 documented redundancies with quoted evidence; each
      of the 4 clean files produces zero high-confidence flags. The exact list
      of sentences to find (and not find) is in `docs/ground-truth-2026-04-17.md`.
- [ ] Semantic job runs end-to-end on a `workflow_dispatch` smoke test;
      `repos.json` shows `semantic_score` populated for all repos; second run
      is idempotent (writes only if fields change).
- [ ] Deterministic job unchanged — still hourly, still identical output if
      API key is absent.
- [ ] Unit tests green, including failure-mode tests (API 429, API 5xx,
      malformed response).
- [ ] Paste-audit UI label is present and legible per DESIGN.md §5.6 rules.
- [ ] Cost estimate validated from real billing: ≤ $5/day at steady state. If
      higher, escalate scope (model choice, batch API, cadence).
- [ ] Post-run distribution on the leaderboard does not collapse to `[185, 0,
      0, 0, 0]` **nor** explode to everything scoring high. If either extreme
      occurs, the prompt is miscalibrated — investigate before merging. The
      expected shape is a modest fraction (roughly 5–25%) of repos scoring
      semantically redundant. Ship whatever number is honest; reject only
      the extremes that indicate prompt failure, not low numbers that indicate
      a clean ecosystem.

**Depends on:** #8 merged (already true: PR #7 merged at `b7f9e3c`, 2026-04-17).
#9 is deferred and no longer blocks this work — the prompt framing that used to
live in #9 is now inline above.

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
PR #5 merged ──> #8 (done, PR #7) ──> #10 ──> #11 ──> #12 (unpause #7)
                                 ╲
                                  └─> #9 [deferred, post-launch]
```

Linear. #9 is off the critical path.

## What this doc does NOT do

- It doesn't expand the catalogue to 300–400 entries. That's a continuous post-launch activity, not a session goal.
- It doesn't change the paste-audit to call an LLM. Architectural constraint: no API keys in the client.
- It doesn't change the deterministic refresh from hourly. The hourly pipeline is correct for the deterministic layer; the daily cadence is for the semantic layer only.
- It doesn't revisit the UI design language. DESIGN.md is stable; the confidence caption and paste-audit label are the only v0.1.x-mandated additions.
