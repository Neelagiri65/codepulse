# HANDOFF — CodePulse

## Session: 2026-04-18 (session 12 — refresh-pipeline wiring, workflow split, local smoke on real APIs)

### State at session start
- `feature/llm-enrichment` at `eb5e95e`, 3 commits ahead of `main` (`a1bfcf3`). Working tree clean.
- `GEMINI_API_KEY` pushed to repo secrets by user before session start.
- NEXT from session 11: TDD the refresh wiring, implement `runSemanticPass`, split `refresh.yml`, `workflow_dispatch` smoke test, then UI.

### Single deliverable
Wire `enrichSemanticScore()` into the refresh pipeline, split the workflow into hourly deterministic + daily semantic, and smoke-test the semantic pass against real APIs. Explicitly deferred: UI (`src/leaderboard.ts`, `src/audit.ts`) and the PR merge — both belong to session 13.

### What happened

1. **Wrote 9 failing tests first** (`993f794`): 2 for `runRefresh` semantic-field carry-over (new `RepoEntry` fields survive deterministic rebuild), 7 for a new `runSemanticPass` covering fresh enrichment, content-hash cache hit/miss, per-repo API-failure isolation (with and without prior semantic fields), CLAUDE.md fetch-null skip, and empty-payload no-op.
2. **Implemented (`d8ecb45`):**
   - `RepoEntry` gains optional `semantic_score`, `semantic_matched_intents`, `semantic_refreshed_at`, `semantic_content_hash`.
   - `runRefresh` indexes prev by `owner/name`, merges semantic fields onto freshly-scored rows via `carryOverSemantic`. `shouldWrite` unchanged — semantic fields carry forward identically, so no deterministic-side write trigger.
   - `runSemanticPass(SemanticPassDeps)` — reads `ReposPayload`, fetches each CLAUDE.md, skips cached entries when `sha256(content) === stored hash`, enriches otherwise. Per-repo `try/catch` preserves prior semantic fields on failure. Returns `{ wrote, enriched, cached, failed, skipped }`.
   - `scripts/refresh-semantic.ts` — CLI gated on both `GH_TOKEN` and `GEMINI_API_KEY`, reuses `makeFetcher` (newly exported from `refresh.ts`). Calls `enrichSemanticScore` with `gemini-2.5-flash`.
   - `.github/workflows/refresh-semantic.yml` — daily cron `0 6 * * *`, shares `concurrency.group: refresh` with the hourly so they never race on a push. Uses `${GITHUB_REF_NAME}` for pull/push so a `workflow_dispatch` from a feature branch doesn't accidentally mass-merge to main.
3. **Attempted remote `workflow_dispatch` smoke test.** GitHub returns 404 — workflows must be registered on the default branch to be dispatchable. Expected constraint, not a bug. Remote smoke test moved to NEXT, post-merge.
4. **Pivoted to local smoke test** on a 3-repo subset carved from live `data/repos.json`: `zenml-io/zenml` (known heavy redundancy), `nearai/ironclaw` (known clean), `protella/chatgpt-bots` (v3 top deterministic scorer). Backed up real `repos.json` to `/tmp/codepulse-smoke/`, ran `GEMINI_API_KEY=... GH_TOKEN=... pnpm refresh:semantic` against the subset, inspected output, restored real file.
5. **Bumped workflow timeout to 75 min (`cc3369e`)** after observing ~19s/repo end-to-end (GitHub fetch + Gemini enrichment). 185 × 19s ≈ 58 min sequential; 75 min leaves headroom without inviting a runaway if Gemini has a bad latency day.

### Numbers

- Tests: **91 pass / 10 skipped / 0 fail** (refresh suite up from 13 → 22 tests).
- Typecheck + build: clean.
- Local smoke (3 repos, real APIs): **56.7s wall time, ~$0.003 Gemini spend**.
- Smoke outputs matched ground-truth expectations verbatim:
  - `zenml-io/zenml` (det=0): sem=**28** from 13 matched intents (1 high, 12 medium). The 5 redundancies `docs/ground-truth-2026-04-17.md` predicted all showed up, plus 8 more legitimate paraphrases (commenting at length, commit conventions, task decomposition).
  - `nearai/ironclaw` (det=0): sem=**1** from exactly the one borderline "Comments for non-obvious logic only" line the manual check flagged. LOW-confidence — calibrated correctly per the rubric.
  - `protella/chatgpt-bots` (det=7): sem=**4** from 4 LOW-confidence matches. All short standalone phrases — rubric holds.
- Projected full run: **~58 min, ~$0.22 Gemini cost, ~370 GitHub API calls** (2 per repo). Inside PRD $5/day cap.

### Key decisions locked
- **Schema locked**: four optional semantic fields, `null` meaning "not enriched yet". Cache keyed on `sha256(content)` — 90%+ cost savings once files stabilise. No migration needed for existing `repos.json` — fields are additive.
- **Shared concurrency group `refresh`** across both workflows. Daily semantic never races the hourly deterministic on a git push.
- **Push target = branch of origin** (`HEAD:${GITHUB_REF_NAME}`). Prevents a feature-branch dispatch from auto-merging to main.
- **Sequential enrichment is good enough** at 19s/repo. Parallelisation deferred until there's a real reason (cost cap breach, latency regression, or catalogue blow-up to 1000+ repos).
- **Remote `workflow_dispatch` smoke test gates merge, not ship.** Do it immediately after the PR lands — the first real daily cron on main IS the smoke test.

### What's done this session
- [x] 9 new failing tests committed (`993f794`).
- [x] `RepoEntry` schema extension + `runRefresh` semantic carry-over.
- [x] `runSemanticPass` + `refresh-semantic.ts` CLI.
- [x] `refresh-semantic.yml` workflow (daily, 75 min timeout, shared concurrency).
- [x] `package.json` — added `refresh:semantic` script.
- [x] Green implementation committed (`d8ecb45`), timeout bump committed (`cc3369e`).
- [x] Local smoke test against real Gemini + GitHub — 3/3 match ground-truth predictions.
- [x] Everything pushed to `origin/feature/llm-enrichment`.

### What's not done (moved to session 13)
- [ ] **Remote `workflow_dispatch` smoke** — blocked until the branch merges to main. Run immediately post-merge to capture first real billing + 185-repo distribution.
- [ ] `src/leaderboard.ts` — blended score display. Formula still not locked; decide from the first full real distribution.
- [ ] `src/audit.ts` — paste-audit UI label per PRD §5.6 (deterministic-only, no semantic pill on audit view).
- [ ] Post-enrichment distribution sanity check. Expected: 5–25% of 185 scoring semantically redundant. If the distribution collapses to `[185, 0, …]` or explodes to everything-flagged, iterate on the prompt — don't patch around the fixture.
- [ ] PR from `feature/llm-enrichment` → `main`. Include the distribution numbers from the first cron in the PR body.

### Git state
- Branch: `feature/llm-enrichment` at `cc3369e`, **6 commits ahead of `main`**, pushed to `origin`.
- `main` at `a1bfcf3`.
- No open PRs — deliberately deferred until UI work lands in session 13.

```
cc3369e ci(enrich): bump semantic workflow timeout to 75 min
d8ecb45 feat(enrich): wire semantic pass into refresh pipeline
993f794 test: failing tests for semantic pass + carry-over
eb5e95e docs: handoff — session 11, #10 ground truth green, Gemini Flash picked
6ccb7d8 feat(enrich): Gemini-backed semantic scoring passes ground truth
3ab8ec7 test: failing ground-truth harness for semantic enrichment (Issue #10)
```

### File operations this session
- Modified inside project: `scripts/refresh.ts`, `scripts/refresh.test.ts`, `package.json`, `.github/workflows/refresh-semantic.yml`, `HANDOFF.md` (this block).
- Created inside project: `scripts/refresh-semantic.ts`, `.github/workflows/refresh-semantic.yml`.
- Created outside project: `/tmp/codepulse-smoke/repos.json.bak`, `/tmp/codepulse-smoke/repos-subset.json` (session-local, not committed).
- Modified outside project: 0.
- Deleted: 0.
- Committed secret values: 0. `GEMINI_API_KEY` and `GH_TOKEN` read from Keychain at call-time, exported into a single subshell, never written to disk or echoed.

### NEXT action (for session 13)
1. **Continue on `feature/llm-enrichment`.** Do not rebranch.
2. **UI, TDD-first:**
   - Update `src/ui.smoke.test.ts` to expect blended-score display when `semantic_score` exists (mock data only — real data still `null` at this point on `main`).
   - Pick formula. Recommend starting with `max(deterministic, semantic_score)` capped at 100 — simplest, no calibration hyperparameter. Revisit if the distribution fights the UX.
   - `src/audit.ts` — wire deterministic-only label per PRD §5.6. Paste audit never shows semantic (it's the public-facing privacy contract).
3. **Open PR** from `feature/llm-enrichment` → `main`. PR body must include: this session's local smoke numbers, the 19s/repo observation, and a pointer to `docs/ground-truth-2026-04-17.md` as the acceptance fixture.
4. **Merge the PR.** This registers `refresh-semantic.yml` on the default branch.
5. **Immediately run `gh workflow run refresh-semantic.yml`** on main. Monitor the run. Capture:
   - Wall time (expected 50–65 min for 185 repos).
   - Gemini spend (expected ~$0.22).
   - Output distribution: how many repos score ≥5 semantically? How many zero-to-zero? Spot-check 3 high-scorers and 3 unchanged-zero against a manual read.
6. **If the distribution is wrong** (collapse or explosion), the fix is the prompt or the Claude-defaults anchor list in `scripts/enrich.ts`. Do NOT tune around the fixture — update the ground-truth doc + rubric, re-run `ground-truth.test.ts`, only then re-ship.
7. **Once distribution sane**, close out Issue #10. Move to #11 or #12 per `docs/issues-v0.1.x-catalogue-depth.md`.

### Open questions / decisions carried
- **Blended-score formula for the pill display** — still not locked. Decide from the first real 185-repo distribution.
- **`/search/code` deprecation (2026-09-27)** — carried. Replace with `/search/repositories` + direct `CLAUDE.md` fetch before September. Separate issue, doesn't block #10 close-out.
- **Parallelisation of `runSemanticPass`** — not needed at current cost + cadence. Revisit only if (a) catalogue expands past 500 repos, (b) Gemini latency regresses, or (c) cost cap triggers.
- **Cache invalidation on catalogue-version bump** — currently we rely on content hash only, which means a future catalogue-version change won't re-trigger enrichment. Probably fine (the enrichment prompt is catalogue-agnostic) but worth revisiting if we extend the anchor set in `scripts/enrich.ts`.

---

## Session: 2026-04-18 (session 11 — Issue #10 ground-truth harness, Gemini pivot, Flash picked)

### State at session start
- `main` at `a1bfcf3`. Working tree clean. No open PRs.
- NEXT from session 10: build `scripts/ground-truth.test.ts` red, implement `enrichSemanticScore()`, test Haiku 4.5 vs Sonnet 4.6 on precision, also investigate `refresh.yml` 22:31Z scheduled-run failure.

### Single deliverable
Get the ground-truth harness green against a real LLM and pick the production model on precision. Rest of Issue #10 integration (refresh.ts wiring, workflow split, schema/UI changes) explicitly out of scope for this session.

### What happened

1. **Diagnosed `refresh.yml` 22:31Z failure.** `scripts/refresh.ts:159` `discoverTopRepos` hit `GET /search/code?q=filename:CLAUDE.md` → GitHub returned 404 (request id `9F41:12561:996173:26B15C4:69E2B4B0`). Manual dispatch 26 min later succeeded with identical code. **Transient `/search/code` flake, not a code bug.** Endpoint is already slated for deprecation 2026-09-27 (carried open question). Worth wrapping in retry/backoff when `/search/code` retires — not blocking #10.
2. **Branched `feature/llm-enrichment`** off `a1bfcf3`.
3. **Committed red harness (`3ab8ec7`):** `scripts/enrich.ts` stub + `scripts/ground-truth.test.ts` gated on `ANTHROPIC_API_KEY`, parametrised over Haiku 4.5 + Sonnet 4.6. Skipped without key; throws on real call by construction.
4. **Pivoted Anthropic → Gemini at user request.** User has `gemini-api-key` in Keychain, no separate Anthropic API key set up. Test and stub adapted to `gemini-2.5-flash` / `gemini-2.5-pro` and `GEMINI_API_KEY` env var.
5. **Installed `@google/genai@1.50.1`; implemented `enrichSemanticScore()`** with structured JSON output (responseSchema), temperature 0, full Issue #10 prompt baked into systemInstruction. Score derivation: `high=4, medium=2, low=1` summed.
6. **First harness run — 4 failures on BOTH models:**
   - zenml reported 3/5 redundancies hit (should have been ≥4).
   - ironclaw reported 1 HIGH flag on "Comments for non-obvious logic only" (should be 0 HIGH).
7. **Ran a direct raw-output dump via `/tmp/codepulse-debug/dump-zenml.mts`.** Discovered:
   - **Both models correctly identified all 5 redundancies.** My anchor substrings were too narrow — missed commenting-policy and commit-message-why-not-what because models quoted with double-quotes (`"why" not just the "what"`) and zenml's actual phrasing (`why the code is this way`, `banner comment`, `narrating`).
   - The ironclaw HIGH flag was a real calibration failure — the 6-word phrase does paraphrase a default, but the ground-truth doc says it must be LOW.
8. **Two-part fix in one iteration:**
   - Expanded zenml anchor substrings to cover the models' actual quoted phrasings.
   - Tightened the prompt with an explicit confidence calibration rubric: "a short standalone phrase (roughly ≤12 words) must be LOW regardless of how closely it paraphrases the default. Reserve HIGH for thorough, explicit, multi-clause duplication."
9. **Second harness run — all 10 tests green on both models.** zenml 5/5 redundancies flagged; ironclaw/supercmd/jsobf/overstory zero HIGH flags. Skipped/no-key behaviour preserved.
10. **Committed green (`6ccb7d8`):** implementation + prompt + expanded test anchors + Issue #10 doc update reflecting Gemini/Flash decision.

### Numbers
- Ground-truth harness: **91 passed / 1 skipped / 0 failed** across both models.
- zenml redundancies hit: **5/5** on both Flash and Pro (test bar: ≥4).
- Clean-file HIGH flags: **0** on all 4 clean files, both models.
- Wall time: Flash ~65s total for 5 fixtures; Pro ~102s.
- Cost per full harness run: **Flash ~$0.024, Pro ~$0.098** (estimated from Gemini 2.5 public pricing — Flash $0.30/MTok in / $2.50/MTok out; Pro $1.25 in / $10 out).
- Projected daily cron cost (185 repos × ~4k tok avg): **Flash ~$0.22/day, Pro ~$0.92/day** — both well inside PRD $5/day cap.
- Harness iterations used: 2 full runs (1 red, 1 red-with-bugs, 1 green) + 1 debug dump. Total real-API spend this session: ~$0.30.

### Key decision locked
- **Production model: `gemini-2.5-flash`.** Both Flash and Pro pass the ground-truth acceptance bar identically; Flash wins on cost + latency. The prompt is model-agnostic; revisit Flash-vs-Pro if a future fixture expansion shows Flash regressing.
- **LLM layer: Gemini, not Anthropic.** Pivoted mid-session per user. Issue #10 doc updated to reflect this.
- **Env var: `GEMINI_API_KEY`** (Keychain: `gemini-api-key`). To run harness: `GEMINI_API_KEY=$(security find-generic-password -s gemini-api-key -w) pnpm test -- scripts/ground-truth.test.ts`.
- **Confidence rubric is part of the spec.** Short standalone phrases → LOW. Multi-clause thorough duplication → HIGH. Don't tune this rubric to fit future fixtures — adjust fixtures or the list of Claude defaults instead.

### What's done this session
- [x] Branched `feature/llm-enrichment` off `a1bfcf3`.
- [x] Wrote red `scripts/ground-truth.test.ts` + `scripts/enrich.ts` stub (`3ab8ec7`).
- [x] Pivoted Anthropic → Gemini stack (SDK, env var, model IDs).
- [x] Implemented `enrichSemanticScore()` with full prompt + structured output.
- [x] Debugged anchor mismatch + confidence calibration via raw output dump.
- [x] Harness green on both Gemini 2.5 Flash and Pro.
- [x] Picked Flash as production model on precision parity + cost.
- [x] Updated `docs/issues-v0.1.x-catalogue-depth.md` #10 to reflect Gemini/Flash choice and session-11 completion status.
- [x] Diagnosed and reported the 22:31Z `refresh.yml` flake (transient GitHub `/search/code` 404).
- [x] Committed green (`6ccb7d8`).

### What's not done (Issue #10 remaining scope — carry to session 12)
- [ ] `scripts/refresh.test.ts` — unit tests with a mocked Gemini client. Verify deterministic score is preserved on API failure; verify cache fields land in `repos.json`.
- [ ] `scripts/refresh.ts` — import `enrichSemanticScore`; wire into a new semantic pass that runs only when `GEMINI_API_KEY` is set.
- [ ] `.github/workflows/refresh.yml` — split into `deterministic` (hourly, existing) + `semantic` (daily at `0 6 * * *`, reads latest `repos.json`, enriches, writes semantic fields, commits). Add `GEMINI_API_KEY` secret read to semantic job only.
- [ ] Push `GEMINI_API_KEY` to `Neelagiri65/codepulse` repo secrets (`gh secret set GEMINI_API_KEY`).
- [ ] `repos.json` schema — add optional `semantic_score: number | null`, `semantic_matched_intents: Array<{quote, reason, confidence}> | null`, `semantic_refreshed_at: string | null`.
- [ ] `src/leaderboard.ts` — display blended score; both raw fields inspectable in tooltip/detail.
- [ ] `src/audit.ts` — paste-audit UI label per PRD v0.1.x amendment.
- [ ] `workflow_dispatch` smoke run on semantic job; capture real Gemini billing; verify daily projected cost ≤$5.
- [ ] Post-enrichment distribution check — must not collapse to `[185, 0, 0, 0, 0]` nor explode to everything-high. Expected shape: 5–25% of repos scoring semantically redundant.

### Git state
- Branch: `feature/llm-enrichment` at `6ccb7d8` (2 commits ahead of main), **not yet pushed**.
- `main` at `a1bfcf3`.
- No open PRs. Session-12 single deliverable will be the refresh integration + workflow split; PR opens at the end of that session.
- `@google/genai@1.50.1` added to dependencies (first non-dev dependency besides `@octokit/rest`).

### File operations this session
- Modified inside project: `scripts/enrich.ts` (new-then-implemented), `scripts/ground-truth.test.ts` (new), `docs/issues-v0.1.x-catalogue-depth.md`, `package.json`, `pnpm-lock.yaml`, `HANDOFF.md` (this block).
- Created: `/tmp/codepulse-debug/dump-zenml.mts` (session-local debug; not committed).
- Modified outside project: 0.
- Deleted: 0.
- Committed secret values: 0. `GEMINI_API_KEY` was only read from Keychain at call-time via inline env export; never echoed or written to disk.

### NEXT action (for session 12)
1. **Start on existing `feature/llm-enrichment` branch** (at `6ccb7d8`, 2 commits ahead). Do NOT branch off main again.
2. **TDD the refresh wiring.** Write failing `scripts/refresh.test.ts` cases covering:
   - `runRefresh()` with semantic pass enabled: calls `enrichSemanticScore()` per repo, merges `semantic_score`/`matched_intents`/`refreshed_at` into `RepoEntry`.
   - API failure path: one repo's enrichment throws → its semantic fields stay `null`, deterministic score unchanged, rest of the refresh continues.
   - `semantic_score` + `matched_intents` round-trip through `repos.json` without mutation.
   - Idempotency: second run with same content produces identical semantic fields (relies on temperature-0 + structured schema; cache previously-enriched entries by content hash to avoid re-cost).
3. **Implement `scripts/refresh.ts` changes** to make those tests pass. Extend `RefreshDeps` with an `enrich?: EnrichFn` injection point so the test can swap in a stub.
4. **Split `.github/workflows/refresh.yml`** into two jobs. Keep hourly deterministic green if `GEMINI_API_KEY` is absent.
5. **Push `GEMINI_API_KEY` to repo secrets** before the first `workflow_dispatch`: `gh secret set GEMINI_API_KEY --body "$(security find-generic-password -s gemini-api-key -w)"`.
6. **Smoke-test the semantic job once via `workflow_dispatch`.** Capture real billing. If > $5/day projected, escalate (batch requests, cache by content hash, or drop to a single daily full-refresh).
7. **Only then touch UI** (`src/leaderboard.ts`, `src/audit.ts`). UI changes must not ship until the data pipeline is producing real `semantic_score` values end-to-end in CI.

### Open questions / decisions carried
- **Blended-score formula for the pill display** — still not locked. Options: `max(det, sem)`, `det + sem`, or a weighted blend. Decide in session 12 once real distribution data is on the leaderboard.
- **Idempotency strategy** — should semantic enrichment re-run only when `content` hash changes since last `semantic_refreshed_at`? Recommendation: yes, cache by `sha256(content)` in a new `semantic_content_hash` field. Saves 90%+ of daily cost once most files stabilise.
- **`/search/code` deprecation (2026-09-27)** — still carried. Should be replaced with `/search/repositories` + direct `CLAUDE.md` fetch before September.
- **Paste-audit deterministic-only policy** — still correct. Semantic layer is CI-only per PRD.
- **Gemini free-tier vs paid** — at ~$0.22/day projected, paid is trivially cheap; free tier (15 RPM + 1,500 RPD) may actually bottleneck a 185-repo batch. Use billed tier. No need to optimise for free tier.

---

## Session: 2026-04-17 → 2026-04-18 (session 10 — PR #7 merge, v3 re-crawl, manual check, thesis revision)

### State at session start
- `main` at `b1a6c81` (pre-merge). `feature/catalogue-batch-a` pushed with PR #7 open (82 entries, v3 catalogue).
- Working tree clean.
- NEXT from session 9: merge PR #7, trigger `refresh.yml`, diff new distribution against `[178, 8, 0, 0, 0]`.

### Single deliverable
Merge PR #7, re-crawl against v3, **read the data honestly**, and set up Issue #10 on solid empirical ground. Not implement #10 — decide what #10 should be.

### What happened

1. **Merged PR #7** via `gh pr merge --merge --delete-branch`. `main` fast-forwarded to `b7f9e3c`. 42 entries + v2→v3 bump shipped.
2. **Triggered `refresh.yml` via `workflow_dispatch`.** Run `24590277407` succeeded in 4m41s. Note: the scheduled run 26 min earlier (`24589512681`) failed in 12s — not investigated, but not blocking since the manual trigger succeeded. Commit `186e1dc data: refresh 2026-04-17T23:01:43Z` auto-pushed by the Action.
3. **Computed new distribution.**
   - v2 (40 entries, 186 repos): `[178, 8, 0, 0, 0]`, max 8, clean 96%.
   - v3 (82 entries, 185 repos): `[175, 10, 0, 0, 0]`, max 7, clean 95%.
   - Doubling the catalogue nudged 2 more repos into the 1–25 bucket and dropped the max by 1, but left the 26–50 / 51–75 / 76–100 buckets empty. No repo crossed out of the bottom two buckets. The regex layer has effectively saturated. Top score: 7 (`protella/chatgpt-bots`, 4 matches).
   - (Correction, committed in `cf550ba`: my real-time report in this session used wrong bucket boundaries and called the distribution `[185, 0, 0, 0, 0]`. The leaderboard's actual buckets are `[0, 1–25, 26–50, 51–75, 76–100]` and the real numbers are above. Narrative conclusion — regex saturated, LLM needed — is unchanged.)
4. **Called the honest-data moment.** Per PRD non-negotiable, did not recalibrate the catalogue. Reported the collapse; user called option 1 (LLM enrichment is the product) and asked for a manual sanity-check before burning a session on Issue #10.
5. **Manual check of 5 zero-score large CLAUDE.md files** (10k–44k chars). Fetched raw from GitHub HEAD. Read line-by-line, classified against the one question: *"Is this sentence instructing Claude to do something Claude already does by default?"*
   - `zenml-io/zenml` (24k): **heavy redundancy** — 5 specific semantic duplicates of Claude defaults (commenting policy, commit messages, root-cause-before-fix, task planning). All paraphrased past regex reach. The product's ground-truth example.
   - `nearai/ironclaw` (17k): clean. One borderline line on comments.
   - `SuperCmdLabs/SuperCmd` (28k): clean. Mostly Raycast API tables.
   - `javascript-obfuscator/javascript-obfuscator` (44k): clean. Project architecture + test command reference.
   - `jayminwest/overstory` (37k): mild. One "Quality Gates" section lightly overlaps with Claude's commit-discipline default.
6. **Thesis revised.** Old: *"most configs are bloated."* New: *"some configs contain invisible semantic redundancy; file size doesn't predict which; developers have no heuristic; LLM enrichment is the only way to answer 'is mine one of them?'"*
7. **Docs updated, committed, pushed (`35f4708` on main):**
   - `docs/ground-truth-2026-04-17.md` — new, the acceptance fixture for Issue #10.
   - `docs/prd-v0.1-leaderboard-and-audit.md` — Problem Statement + "What v0.1 Proves" rewritten.
   - `docs/issues-v0.1.x-catalogue-depth.md` — Issue #10 rewritten with the exact prompt framing and ground-truth-backed acceptance criteria. Issue #9 (batch B regex) deferred, no longer blocks #10.
   - `CLAUDE.md` — first-read list updated to surface the ground-truth doc.

### Numbers
- Catalogue v3 distribution: `[175, 10, 0, 0, 0]`, max 7 — regex layer has saturated.
- Manual check redundancy hit rate: 1 of 5 large clean-bucket files contains catchable redundancy. That's the rate the LLM layer is grading itself against.
- Docs changed this session: 4 files (1 new, 3 modified). 360 insertions, 31 deletions.
- Code changed: 0.

### Key decision locked
**Issue #10's LLM prompt must implement exactly this question, verbatim, per the PRD:**
> "Is this sentence instructing Claude to do something Claude Code already does by default?"

Not "does this sound like generic advice." Not "is this verbose." The prompt is graded against `docs/ground-truth-2026-04-17.md` — must flag ≥4 of the 5 documented zenml redundancies, must not high-confidence-flag the 4 clean files. Over-flagging ships no product; a false positive on `javascript-obfuscator`-style architecture docs would be worse than the current null-result state.

### What's done this session
- [x] Merged PR #7; branch deleted.
- [x] Triggered `refresh.yml`; data committed by Action.
- [x] Pulled fresh `repos.json`, computed v3 distribution.
- [x] Reported empirical finding honestly (no catalogue recalibration).
- [x] Fetched 5 CLAUDE.md fixtures, read each manually.
- [x] Wrote `docs/ground-truth-2026-04-17.md`.
- [x] Rewrote PRD Problem Statement + "What v0.1 Proves".
- [x] Rewrote Issue #10 against ground-truth fixture.
- [x] Deferred Issue #9 from the critical path.
- [x] Updated CLAUDE.md first-read list.
- [x] Committed + pushed `35f4708`.

### What's not done
- [ ] **Issue #10 implementation** — next session's single deliverable.
- [ ] `refresh.yml` scheduled-run failure mode (12s crash at 2026-04-17T22:31:03Z, run `24589512681`) — not investigated. Action succeeded on manual dispatch so it's not blocking, but worth a look during #10 work.
- [ ] Issues #11, #12 remain gated on #10.

### Git state
- Branch: `main` at `35f4708`, pushed.
- `data/repos.json` current as of `186e1dc` (2026-04-17T23:01:43Z refresh) with 185 repos scored against v3.
- No open PRs.
- `/tmp/codepulse-manual-check/` holds the 5 fetched fixture files (session-local, not committed — fetch commands are in `docs/ground-truth-2026-04-17.md` for reproducibility).

### File operations this session
- Modified inside project: `CLAUDE.md`, `docs/prd-v0.1-leaderboard-and-audit.md`, `docs/issues-v0.1.x-catalogue-depth.md`, `HANDOFF.md` (this block).
- Created: `docs/ground-truth-2026-04-17.md`, `/tmp/codepulse-manual-check/*.md` (5 fixture files, session-local).
- Modified outside project: 0.
- Deleted: 0.
- Committed secret values: 0.

### NEXT action (for session 11)
1. **Start a fresh session on `feature/llm-enrichment`** (branch off current `main` at `35f4708`).
2. **Implement Issue #10 per `docs/issues-v0.1.x-catalogue-depth.md` #10.** Specifically:
   - Write the LLM prompt exactly as framed — single question, anti-over-flagging rules, project-specific vs default distinction.
   - Build `scripts/ground-truth.test.ts` harness gated on `ANTHROPIC_API_KEY`. Must fetch the 5 fixture files from the URLs in `docs/ground-truth-2026-04-17.md`, run the prompt, assert ≥4 of 5 zenml redundancies flagged + 4 clean files not high-confidence-flagged.
   - Wire `scripts/refresh.ts` → `enrichSemanticScore()`. Gate behind env var. Preserve deterministic score on API absence/failure.
   - Split `refresh.yml` into hourly deterministic + daily semantic jobs. Add `ANTHROPIC_API_KEY` secret read to the semantic job only.
   - Extend `repos.json` schema with `semantic_score`, `semantic_matched_intents`, `semantic_refreshed_at` (all optional).
   - Update `src/leaderboard.ts` to display blended score with both fields inspectable.
   - Add mandatory paste-audit UI label per DESIGN.md §5.6.
3. **Before merging the PR**: run the ground-truth harness against real API. Capture the flag rate and quotes in the session's handoff. If zenml hit rate < 4/5 or any clean file produces a high-confidence flag, iterate on the prompt before shipping — do not tune around the fixture to pass it.
4. **Cost discipline**: first smoke test is one manual `workflow_dispatch` of the semantic job. Capture real API billing. If >$5/day projected, escalate scope (model choice, batch API, cadence) before enabling the daily cron.

### Open questions / decisions carried
- `refresh.yml` 12s crash on 2026-04-17T22:31:03Z — not investigated.
- LLM model choice for #10 — not locked. Claude Haiku 4.5 is the default assumption per cost-first framing, but the prompt may need Sonnet 4.6's judgement to avoid over-flagging. Test both on the ground-truth fixture before committing.
- Blended score formula (displayed pill value) — not locked. Simplest: `max(deterministic, semantic)`. Needs a decision in #10 or #11.
- Paste-audit deterministic-only scoring remains the policy per PRD amendment. Revisit only if user strongly objects to the asymmetry after launch.

---

## Session: 2026-04-17 (session 9 — Issue #8 catalogue batch A, 42 new entries, v2→v3)

### State at session start
- `main` at `b1a6c81` (PR #6 merge).
- `feature/catalogue-batch-a` already existed off fresh main (branched in prior session).
- 10 sample CLAUDE.md files in `/tmp/codepulse-samples-v0.1.x/` (4 dirty-bucket + 6 clean-bucket) from session 8's sampler run.

### Single deliverable
Issue #8 extraction pass — draft candidate patterns from the 10-sample corpus, run the over-match gate against the 6 clean-bucket files, apply the hardening-≠-redundancy gate, add surviving entries to `data/catalogue.json`, bump version 2→3.

### What happened
1. **Drafted 70 numbered candidates** in `/tmp/codepulse-draft/candidates.md` from: (a) the 10-sample corpus primary extraction, (b) uncited Piebald system-prompt files in source class B (executing-actions, software-engineering-focus, ambitious-tasks, todowrite, communication-style, grep, readfile, websearch, enterplanmode, agent-usage-notes, bash-sleep variants). Of 70, ~42 were retained as genuine restatement-of-default candidates; the rest were skipped as duplicates of existing entries, too generic/tool-specific, or hardening-risk.
2. **Over-match gate passed cleanly.** `/tmp/codepulse-draft/overmatch-gate.mjs` ran all 42 regexes against the 10 samples and the 6 clean-bucket files: **zero hits on clean-bucket prose**. Three dirty-bucket hits confirmed extraction (preserve-existing-behavior, test-your-changes, dont-assume-code-works all fired on `nwiizo/cctx`).
3. **Hardening gate passed.** All 42 restate CC defaults without being stricter. The one borderline — `confirm-before-hard-to-reverse` — explicitly uses confirmation phrasing (matches the default) rather than banning (which would be stricter, and was the reason session 5 dropped `no-force-push` and `no-reset-hard`).
4. **Applied batch.** `/tmp/codepulse-draft/apply-batch-a.mjs` appended 42 entries (all `regex` match_type, weights 2–4), bumped `version` 2→3, `updated_at` → 2026-04-17. Validator clean (82 entries). Typecheck clean. One pre-existing unit test (`ui.smoke.test.ts`) asserted `catalogue v2` in the hero sub — updated to v3. 81/81 vitest green.
5. **Commit shipped:** `05dd1e3 feat(catalogue): batch A — 42 new entries, v2→v3` on `feature/catalogue-batch-a`.

### Batch A coverage (42 new entries by topic)
- **Executing-actions defaults (7):** scope-match-request, investigate-before-deleting, identify-root-cause-not-bypass, confirm-before-hard-to-reverse, dont-upload-sensitive-to-third-party, investigate-lock-files, resolve-merge-conflicts-not-discard.
- **TodoWrite restatements (5):** only-one-task-in-progress, dont-mark-complete-if-failing, blocked-task-create-followup, proactive-task-management, capture-user-requirements-as-todos.
- **Agent tool restatements (4):** trust-but-verify-subagent, agent-prompt-self-contained, agent-for-code-vs-research, dont-poll-background-tasks.
- **Bash/tool defaults (5):** dont-sleep-between-commands, keep-sleep-short, verify-parent-dir-before-create, dont-use-rg-directly, use-absolute-paths-in-read.
- **Communication-style defaults (7):** no-preamble-greeting, match-response-length-to-task, state-action-before-tool, brief-in-progress-updates, no-trailing-summary, no-running-commentary, dont-create-intermediate-files.
- **Task-focus defaults (10):** preserve-existing-behavior, doc-only-when-requested, test-your-changes, dont-assume-code-works, no-feature-flags-for-changes, no-half-finished, no-validation-for-impossible-cases, no-why-whatsoever-comments, no-pr-description-in-comments, dev-server-test-before-complete.
- **WebSearch + Plan defaults (4):** use-websearch-for-recent-info, use-current-year-in-searches, use-plan-mode-nontrivial, defer-to-user-on-scope.

### Numbers
- Cumulative: **40 → 82 entries** (+42, 84% of 50-entry target).
- Shipped honest count per PRD rule rather than padding to 50. The 42 that passed both gates are the defensible set; another 28 candidates were skipped (duplicates, too generic/tool-specific, hardening-risk).
- All 42 regexes compile. Zero over-match on 6 clean-bucket files.

### What's done this session
- [x] Candidate drafting (70 numbered candidates in `/tmp/codepulse-draft/candidates.md`).
- [x] Over-match gate against 6 clean-bucket files (zero hits).
- [x] Hardening-≠-redundancy gate applied (42/42 pass).
- [x] Catalogue bumped to v3 with 42 new entries.
- [x] `pnpm validate:catalogue` green (82 entries). `pnpm typecheck` clean. 81/81 vitest tests pass.
- [x] Secret scan pre-push: no secret values — only a regex pattern containing the word "secret" as part of `dont-upload-sensitive-to-third-party`. Clean.
- [x] Commit `05dd1e3` on `feature/catalogue-batch-a`.
- [x] HANDOFF commit `3f887e6`.
- [x] Branch pushed to remote; **PR #7 open**: https://github.com/Neelagiri65/codepulse/pull/7

### What's not done
- [ ] **Merge PR #7** (awaiting human review).
- [ ] Post-merge: trigger `refresh.yml` once and diff bucket counts against `[178, 8, 0, 0, 0]`.
- [ ] Issue #9 catalogue batch B (60 more entries target, cumulative ~142).
- [ ] Issue #10 CI semantic enrichment (LLM layer).
- [ ] Issue #11 scoring-asymmetry doc + self-audit.
- [ ] Issue #12 unpause launch.

### Git state
- Branch: `feature/catalogue-batch-a` at `3f887e6` (2 commits ahead of main), pushed. PR #7 open.
- `main` at `b1a6c81`.
- `data/catalogue.json` now shows `version: 3, updated_at: 2026-04-17, patterns.length: 82`.
- `src/ui.smoke.test.ts:47` updated to assert `catalogue v3` in hero sub.

### File operations this session
- Modified inside project: `data/catalogue.json` (+42 entries, version bump, updated_at bump), `src/ui.smoke.test.ts` (v2→v3 assertion), `HANDOFF.md` (this block).
- Modified outside project: 0.
- Created: `/tmp/codepulse-draft/candidates.md`, `/tmp/codepulse-draft/overmatch-gate.mjs`, `/tmp/codepulse-draft/apply-batch-a.mjs` (session-local scratch, not project dir).
- Deleted: 0.
- Committed secret values: 0.

### NEXT action (for the next session)
1. **Review + merge PR #7** (https://github.com/Neelagiri65/codepulse/pull/7). After merge, re-run hourly refresh once (`gh workflow run refresh.yml`) to re-score 186 repos against v3 catalogue. Diff the bucket counts against `[178, 8, 0, 0, 0]` — per the PRD honest-data rule, if distribution shifts toward higher buckets, the catalogue was the bottleneck; if it stays flat, the thesis still needs rewriting (not the catalogue).
2. **Issue #9 — catalogue batch B, 60 more entries.** Expand the sample corpus (next pass of `pnpm sample:claude-mds --seed 1` to get different picks) and repeat the extraction loop. Cumulative target ~142. Keep applying the same two gates.
3. **Before session 10**: confirm the LLM hybrid scope (v0.1.x CI-only vs v0.2 full) per the PRD amendment.

### Open questions / decisions carried
- `/search/code` deprecation (2026-09-27) — post-launch.
- `robo-poet` `no-emojis` hit — survives v3 unchanged; re-evaluate when batch B lands.
- `last_checked_at` in `meta.json` — still deferred.
- LLM hybrid layer scope — still v0.1.x CI-only per PRD amendment `9cf4c88`.

---

## Session: 2026-04-17 (session 8 — catalogue-depth kickoff, PR #6 open)

### State at session start
- `main` at `64c5c60` (PR #5 merge).
- `feature/catalogue-depth-kickoff` already had two commits from the session-7 tail warmup: `9cf4c88` (PRD v0.1.x amendment locking CI-only LLM enrichment) and `a9aaa96` (confidence caption on hero).
- Untracked: `docs/issues-v0.1.x-catalogue-depth.md` partially drafted before the session-7 compaction.
- Live data on `main`: 186 repos, distribution `[178, 8, 0, 0, 0]`, max 8 — still the honest-data finding driving this branch.

### Single deliverable for this session
Close the kickoff: commit the issues doc, ship the sample-selection script, close the "cannot visually verify" gap with a real browser e2e suite. One PR, scoped as enabling infrastructure for Issues #8–#12 — no catalogue-content changes yet.

### Design decisions locked
- **Sampler PRNG = mulberry32 (seeded).** Deterministic, tiny, inline. Lets the methodology step "stratified sampling with seed=N" produce the same ten repos every time — reproducibility is part of the credibility bar.
- **Sampler ignores score >25.** Higher buckets currently empty (confirmed in `data/repos.json`). Keeping the filter narrow now prevents future score-inflation from silently changing what "dirty bucket" means; revisit if/when semantic enrichment lands and fills higher buckets.
- **File extension normalised to `.ts`** (not `.mts`) to match `refresh.ts` / `validate-catalogue.ts`. `.mts` breaks `moduleResolution: bundler` when sibling tests import it.
- **E2E lives at `tests/e2e/`, runner = Playwright + Chromium.** Vitest excludes `tests/e2e/**` via `vite.config.ts test.exclude` — the two runners stay fully separated. `pnpm test:e2e` spins up `pnpm dev --port 5173 --strictPort` via Playwright's `webServer`.
- **Tests read `data/*.json` from disk at test load.** Same file the dev server serves via Vite JSON import — bucket counts, repo counts, matched-pattern IDs all derive from live data, so the suite survives the hourly drift without assertion churn.
- **Playwright artefacts gitignored** (`test-results/`, `playwright-report/`).

### What happened (commits on `feature/catalogue-depth-kickoff` ahead of main)
1. `9cf4c88 docs(prd): lock CI-only LLM enrichment as v0.1.x amendment` — session-7-tail warmup.
2. `a9aaa96 feat(ui): confidence surface on hero — catalogue coverage caption` — session-7-tail warmup.
3. `87255fa docs: issues-v0.1.x — catalogue depth decomposition` — #8 batch A (50 entries), #9 batch B (60 entries) + LLM spec lock, #10 CI semantic enrichment, #11 scoring-asymmetry doc + self-audit, #12 unpause launch. Methodology locked.
4. `3ffae35 test: failing tests for sample-claude-mds — issue #8 prep` — 6 cases covering `stratify()` determinism, bucket filtering, cap handling, and `runSampling()` orchestration with injected deps.
5. `e8a61a1 feat: sample-claude-mds — stratified CLAUDE.md fetcher for catalogue extraction` — implementation + `pnpm sample:claude-mds` script.
6. `8d9d0e7 test(e2e): Playwright suite against live dev server — 15 scenarios` — hero, histogram, table sort (3 keys), row click → popup URL, paste-audit (redundant/clean/empty), responsive 375/768/1440px, LCP <2s, footer, confidence caption.

### Sampler smoke test (end-to-end proof)
Ran `GH_TOKEN=$(gh auth token) pnpm sample:claude-mds` — 10 files written to `/tmp/codepulse-samples-v0.1.x/` with realistic diversity: 43B (`KernelFreeze/CelestialWhitelister`) to 72KB (`mrbestnaija/portofolio_maximizer`). 4 dirty-bucket repos in the sample (`nunomaduro/whyphp.dev`, `nwiizo/cctx`, `PoC-Consortium/pocx`, `vibeforge1111/vibeship-scanner` — all score 1–25) + 6 clean-bucket repos. **These are the inputs for the session-9 Issue #8 extraction pass.** Don't re-run unless you want different picks; bump `--seed` if you do.

### E2E results (15/15 green, 6.3s total)
- Hero renders `186 CLAUDE.md files measured · 96% clean` and `CODEPULSE` wordmark.
- Confidence caption present, reads `Scored against 40 catalogue patterns — narrow scan, not a comprehensive audit.`, links to `catalogue-authoring.md` with `target=_blank`.
- Histogram renders 5 bars with counts `[178, 8, 0, 0, 0]` matching `data/repos.json`.
- Table 186 rows; default sort = score-desc with stars tiebreak; clicking Stars/Chars/Updated headers re-orders correctly; second click flips direction; clicking `.col-repo` opens a popup at `https://github.com/<owner>/<name>`.
- Paste-audit: empty state visible; pasting `"Be concise. Prefer editing existing files. No emojis."` hits `be-concise` + `prefer-editing` at minimum (score > 0); pasting a project-specific clean snippet shows score `0` + "No catalogued redundancy patterns matched".
- Responsive: `document.documentElement.scrollWidth ≤ clientWidth` at 375/768/1440px; `.leaderboard-scroll` is scrollable (`scrollWidth >= clientWidth`) at all three widths.
- LCP measured via buffered `PerformanceObserver` — well under 2000ms in dev mode (would be lower against `pnpm preview`).
- Footer shows `catalogue v2 · 40 patterns · scoring deterministic · source github.com/Neelagiri65/codepulse`.

### What's done this session
- [x] Issues doc committed (`docs/issues-v0.1.x-catalogue-depth.md`, 125 lines, 5 issues + dependency graph).
- [x] Sampler shipped TDD (6 new unit tests red → green, full vitest suite 81/81).
- [x] Sampler smoke-tested against live GitHub (10 files fetched, spread 43B–72KB).
- [x] Playwright 1.59.1 installed + Chromium. `tests/e2e/codepulse.spec.ts` shipped, 15/15 green.
- [x] `vite.config.ts` excludes `tests/e2e/**` from vitest. `.gitignore` excludes `test-results/` and `playwright-report/`.
- [x] `pnpm typecheck` clean. `pnpm validate:catalogue` green (40 entries unchanged).
- [x] Secret scan pre-push: only `ANTHROPIC_API_KEY` as a *secret name* in doc text — no values. Clean.
- [x] PR #6 opened: https://github.com/Neelagiri65/codepulse/pull/6

### What's not done
- [ ] Merge PR #6 (awaiting human review).
- [ ] Issue #8 extraction pass — use `/tmp/codepulse-samples-v0.1.x/` (already populated) as input, extract candidate patterns, run the over-match gate against the clean-bucket files, validate. Target: 50 new entries.

### Git state
- Branch: `feature/catalogue-depth-kickoff` at `8d9d0e7`, pushed, PR #6 open.
- `main` at `64c5c60` (unchanged since PR #5 merge).
- No other feature branches.
- Hourly refresh still writing to `data/repos.json` on main via cron; the e2e suite reads from disk at test load, so drift doesn't break the assertions.

### File operations this session
- Created: `docs/issues-v0.1.x-catalogue-depth.md`, `scripts/sample-claude-mds.ts`, `scripts/sample-claude-mds.test.ts`, `playwright.config.ts`, `tests/e2e/codepulse.spec.ts`.
- Modified inside project: `package.json` (+ `sample:claude-mds`, `test:e2e`, `@playwright/test` dep), `pnpm-lock.yaml`, `vite.config.ts` (vitest exclude), `.gitignore` (playwright artefacts), `HANDOFF.md` (this block).
- Modified outside project: 0.
- Created outside project: `/tmp/codepulse-samples-v0.1.x/` (10 CLAUDE.md files — expected, session-local sample inputs; not the project dir).
- Deleted: 0.
- Committed secret values: 0.

### NEXT action (for the next session — Issue #8 extraction)
1. **Merge PR #6** into `main` (review the 6-commit sequence first; should be readable commit-by-commit).
2. **Branch `feature/catalogue-batch-a`** off fresh `main`.
3. **Read `/tmp/codepulse-samples-v0.1.x/`** — 10 files already fetched this session. If they're gone from `/tmp` (reboot etc.), re-run `pnpm sample:claude-mds` with `--seed 0` to get the same picks.
4. **Extraction pass** per methodology in the issues doc:
   - 4 dirty-bucket files = signal-heavy, easy wins. Read line-by-line, flag instructions that restate a documented default.
   - 6 clean-bucket files = double duty — catalogue-miss candidates AND the over-match gate's clean-prose corpus.
   - Record proposed patterns in a scratch file with: verbatim line, proposed `match_value`, candidate `source_url`, `reason`, proposed `weight`.
5. **Over-match gate.** For each candidate regex, test it against the 6 clean-bucket files. If it fires on non-redundant prose, tighten or drop.
6. **Hardening-≠-redundancy gate.** Reject anything that targets destructive-op guards or security asserts that are stricter than Claude Code's default.
7. **Validator.** `pnpm validate:catalogue` after every batch commit. `version: 2 → 3`, `updated_at` bump.
8. **Target: 50 new entries** this session (cumulative ~90). If credibility work only yields 30, ship 30 honestly rather than pad. Per PRD rule.

### Open questions / decisions deferred (carried forward)
- `/search/code` deprecation (2026-09-27) — post-launch.
- Drift-driven hourly commits threshold — not urgent.
- Slash-command extension research — still deferred.
- `robo-poet` smoke-test `no-emojis` hit — re-evaluate inside the session-9 over-match gate.
- `last_checked_at` in `meta.json` — revisit if needed.
- LLM hybrid layer scope — decision pinned in PRD amendment (`9cf4c88`): v0.1.x CI-only. Close this one.

---

## Session: 2026-04-17 (session 7 tail — PR #5 merged, strategic pivot: catalogue is the critical path, NOT the launch)

### What happened after PR #5 opened
1. **PR #5 merged** (`gh pr merge 5 --merge --delete-branch`) → merge commit `64c5c60`. `feature/leaderboard-ui` deleted locally and on remote. Main now includes DESIGN.md, leaderboard, paste-audit, shared score pill, format utilities, happy-dom DOM smoke tests, and the dump-dom dev aid.
2. **User inspected the UI and named the real problem.** The UI is fine. The score distribution (96% at 0, max 8/100) is not evidence about the ecosystem — it is the honest output of a narrow instrument. The catalogue at 40 patterns is a prototype, not a product. Quote preserved below so the next session reads the reasoning cold.

### User's strategic assessment (verbatim so context survives)
> The accuracy problem is real. 96% scoring zero doesn't mean the data is wrong — it means the catalogue is too narrow. 40 patterns against the full diversity of what people write in CLAUDE.md files is like checking for 40 specific sentences in a 10,000-word essay. Most files contain instructions that are genuinely redundant but phrased differently from what the catalogue expects. The scoring engine is technically accurate against its catalogue — it's the catalogue that's insufficient.
>
> What World Monitor does differently: World Monitor aggregates data from 65+ verified public sources (USGS, GDELT, Reuters, ACLED) where the data is inherently trustworthy because the sources are authoritative. CodePulse is generating its own scores from a hand-built catalogue of 40 patterns. That's not the same confidence level.
>
> What needs to happen before this is trustworthy:
> 1. **Catalogue 10x larger.** 40 patterns is a prototype. Need 300–400 patterns covering actual diversity of redundant instructions. That's the core product work.
> 2. **Scoring needs an LLM layer.** Regex/phrase matching was right for v0.1 to prove pipeline. Real redundancy detection requires semantic understanding — "make sure to read files before editing them" and "always check file contents first" are the same instruction but no regex catches both. Hybrid scoring (catalogue for obvious 80%, Claude API for the rest) needs to come in sooner than planned.
> 3. **Dashboard needs to show confidence level.** "Scored against 40 known patterns" should be prominent. Users need to understand this is a narrow scan, not a comprehensive audit. World Monitor shows source freshness + data gaps — CodePulse should show catalogue coverage limitations.
>
> Recommendation: Don't deploy this publicly yet. Merge the PR so the code is on main, but don't launch. Spend the next two sessions expanding the catalogue significantly — manually review 50 real CLAUDE.md files from the scored repos, extract every instruction that's genuinely redundant, add patterns. Get the catalogue to 150+ entries. Then re-run the crawl and see if the distribution shifts. If it does, the product is getting more accurate. If it doesn't, the thesis genuinely needs rethinking.
>
> Pipeline and UI are solid. The intelligence layer (the catalogue) is what needs depth before this is credible enough to publish.

### What this changes (roadmap-level)
- **Issue #7 (deploy + domain + launch) is PAUSED.** Not cancelled, not reordered — paused until the catalogue has credibility depth.
- **New issues required.** The backlog now needs: **#8 catalogue expansion to 150+ entries** (two sessions, hand-authored, methodology locked below) and **#9 hybrid LLM scoring layer** (v0.1.x scope question still open — see below). Draft as a new issues doc before either starts.
- **Confidence surface on the dashboard.** User called this out explicitly. Pre-launch must-have; **not added to PR #5 because the user said "merge the PR" without attaching this as a precondition.** Belongs in the first commit of session 8.

### Catalogue-expansion methodology (pins the work so session 8 doesn't drift into gut-feel)
Inherit all existing rules from `docs/catalogue-authoring.md` (three admissible source classes, "hardening ≠ redundancy," review checklist, weight scale) and add the operational loop:
1. **Sample selection.** Pull 50 CLAUDE.md files from the scored leaderboard. Stratify: 20 from bucket 1–25 (where signal already exists), 30 from bucket 0 (where patterns likely lurk un-caught). Use `scripts/smoke-test.mts` output as the lookup.
2. **Extraction pass.** For each file, read line-by-line. Flag any instruction that restates a documented Claude Code default or Piebald system-prompt directive. Record: line text verbatim, proposed `match_value` (phrase OR regex), candidate source_url.
3. **Dedup + generalise.** Collapse near-duplicates into one regex where possible. Avoid over-specific literal phrases that will only match this file.
4. **Over-match gate.** For each proposed pattern, smoke-test against at least 3 files from the clean bucket (0) to verify it doesn't fire on non-redundant prose. Drop or tighten anything that over-matches.
5. **Validator.** `pnpm validate:catalogue` after every batch. Never leave an invalid state on disk.
6. **Target:** 150+ entries after two sessions. Stretch: 200. (User's 300–400 is the eventual state, not a two-session goal.)
7. **Re-run the crawl.** After the expansion, `workflow_dispatch` the refresh Action. Diff the bucket counts vs current `[178, 8, 0, 0, 0]`. Two outcomes:
   - Distribution shifts meaningfully toward higher buckets → catalogue was the bottleneck. Expansion was right call.
   - Distribution stays flat → the top-of-ecosystem genuinely is cleaner than theorised. Thesis needs rewrite, not the instrument.
   Either outcome is shippable data per PRD honest-data rule.

### Open question — LLM hybrid layer scope
PRD v0.1 architectural constraint: **"No per-audit LLM calls. Scoring is deterministic, catalogue-based, runs identically in the browser and in the GitHub Action."** User's note says the LLM layer "needs to come in sooner than planned." That is a scope change:
- **v0.1.x (sooner path):** Claude API call inside the CI refresh *only* (not in the browser), results cached into `repos.json`. Browser paste-audit stays deterministic/catalogue-only — no API keys ship to client. Preserves the "no per-audit LLM calls from browser" spirit, relaxes the "identical in browser and Action" letter.
- **v0.2 (planned path):** stays planned, no change.
Before session 9 starts: clarify which bucket this lands in. Cost question too — hourly refresh × 200 repos × LLM call = non-trivial bill.

### Catalogue expansion is not a blocker for some other work
Session 8 can ALSO include, if time permits:
- Add the **confidence surface** to the UI (see §"What this changes"). ~30 minutes: one prominent banner + the catalogue count wired in at build time, with a link to `docs/catalogue-authoring.md`. Small commit, low risk.
- Fix any drift from DESIGN.md identified when the user finally eyeballs the dev server (still pending from this session).

### Git state
- `main` at `64c5c60` (PR #5 merge commit).
- No open branches.
- Data on main: `data/repos.json` `[178 @ 0, 8 @ 1–25, 0 elsewhere]`, max 8. Will continue to drift at the hourly cron until the next catalogue change triggers a real re-score.

### File operations this session tail
- Modified inside project: `HANDOFF.md` (this block).
- Modified outside project: 0.
- Deleted: `feature/leaderboard-ui` (local + remote) — part of `gh pr merge --delete-branch`.
- Committed secret values: 0.

### NEXT action (for the next session — Issue #8, catalogue expansion kickoff)
1. **Read this handoff block + `docs/catalogue-authoring.md` + the methodology above.** Do NOT skip the "over-match gate" step — that's where credibility lives.
2. **Create `docs/issues-v0.1.x-catalogue-depth.md`** decomposing the 150-entry expansion into two sessions (session 8: 50 more entries, session 9: 60 more entries, plus the re-crawl and thesis check). Include the LLM-scope decision as an explicit blocker before session 9 starts.
3. **Commit a small confidence-surface update** to the dashboard as a warmup — user explicitly flagged this as needed. Render something like "scored against N catalogue patterns · narrow scan, not a comprehensive audit" under the hero sub, with a link to `docs/catalogue-authoring.md`. Use the same DESIGN.md tokens.
4. **Begin the first extraction pass.** Fetch 10 real CLAUDE.md samples stratified per methodology step 1. Read them, draft candidate patterns, run over-match gate, validate, commit.

### Decisions still deferred (carried — none closed this tail)
- `/search/code` deprecation (2026-09-27) — post-launch, which is further away now.
- Drift-driven hourly commits threshold — not urgent.
- Slash-command extension research — still deferred.
- `robo-poet` smoke-test `no-emojis` hit — re-evaluate inside the session-8 over-match gate.
- `last_checked_at` in `meta.json` — revisit if needed.
- **NEW:** LLM hybrid layer scope (v0.1.x vs v0.2) — must decide before session 9.

---

## Session: 2026-04-17 (session 7 — Issues #5 + #6, DESIGN.md + UI)

### State at session start
- `main` at `ddfd30c`, clean working tree.
- 186 repos scored live on main (hourly cron firing since session 6).
- Distribution: 178 at 0, 8 in 1–25, 0 in higher buckets. Max 8/100. Thesis-contradicting data; framing pivot already agreed.
- NEXT from session 6 tail: Issue #5 UI, pre-work first: write `DESIGN.md` before any component code. Dark monitoring dashboard, World Monitor + Linear, health-gradient accents, mono data / sans labels.

### Single deliverable for this session
`DESIGN.md` locked, then Issues #5 (leaderboard UI) + #6 (paste-audit UI) implemented against it. User explicitly asked for both UIs in one session; one-PR-per-issue rule relaxed by direct user direction.

### Design decisions locked
- **Skipped Stitch option-generation.** User already had a locked direction (dark monitoring, WM + Linear). Writing DESIGN.md directly saved a round of token-heavy Stitch calls for options the user had pre-ruled-out. Confirmed "direct" at session start.
- **Dark theme only**, no light-mode toggle in v0.1. Monitoring dashboards live dark.
- **Single accent system = health gradient** (`--health-0..4` red→teal ramp). No "brand blue," no purple. If the code needs a CTA colour, it uses `--fg-0` on `--border-strong` outline and lets typography carry hierarchy.
- **Mono for data, sans for labels.** Tabular-nums mandatory on all numeric cells. Uppercase + `0.04em` tracking reserved for column headers.
- **Flat.** No `box-shadow`, no gradients, no rounded-xl. Hierarchy via `--bg-0..3` + 1px `--border`.
- **Data inlining over runtime fetch.** `data/repos.json` + `data/catalogue.json` imported at build time via Vite JSON import. Bundle is ~55KB JS gzip 15KB — fewer hops, better LCP, still compliant with the PRD "zero network calls after loading own static assets" rule (inlined data = own static assets). Hourly Vercel rebuild handles freshness.
- **Histogram sits beside the leaderboard**, not below. The honest-data story ("96% score 0, median 0, max 8") is the headline, not a footnote.
- **Score pill is the reusable primitive.** Used in the leaderboard score column and as the lg variant in the paste-audit scorecard. Same bucket→health-token mapping, one source of truth (`src/format.ts`).

### What happened
1. `feature/leaderboard-ui` branched off clean `main`.
2. `33f694b design: DESIGN.md` — 250 lines locking tokens (colour, typography scale, spacing, radius, motion, a11y), components (hero, histogram, table, score pill, paste-audit card, footer), and explicit anti-patterns (no light mode, no logo, no icons beyond external-link glyph, no gradients).
3. TDD for format utilities:
   - `aa36b6d test: failing tests for format utilities` — 11 cases covering `formatStars`, `formatRelativeTime`, `bucketForScore`, `healthToken`, `distribution`. Red.
   - `b8d5dea feat: format utilities` — pure helpers, no I/O. Distribution returns per-bucket counts + cleanPct/median/max so the hero renders without view-layer math. Green; 61/61 tests now pass.
4. `cf8a15b feat(ui): leaderboard` — `src/styles.css` (tokens → CSS vars), `src/scorecard.ts` (shared score pill + paste scorecard builder), `src/leaderboard.ts` (hero + histogram + sortable table, score-desc default with stars tiebreak, row click opens repo on GitHub), updated `index.html` (dark color-scheme, descriptive meta).
5. `8291e00 feat(ui): paste-audit` — `src/audit.ts` (dual-pane card with live char/token counters; reuses `renderPasteScorecard`), `src/main.ts` (inlines data, mounts both sections + footer).

### Live-data sanity check (pre-commit)
`distribution(repos.repos.map(r => r.score))` against current `data/repos.json`:
- total: 186, clean: 178, cleanPct: 96
- buckets: `[{0,0,178}, {1–25,8}, {26–50,0}, {51–75,0}, {76–100,0}]`
- max: 8, median: 0

Hero will render: **"186 CLAUDE.md files measured · 96% clean"** with sub "median redundancy 0 · max 8 · catalogue v2." Matches session-6 HANDOFF exactly.

### What's done this session
- [x] `DESIGN.md` locked (dark monitoring dashboard system).
- [x] Format utilities shipped TDD (11 new tests).
- [x] Issue #5 leaderboard UI (hero + histogram + sortable table).
- [x] Issue #6 paste-audit UI (textarea + client-side scorecard).
- [x] 61/61 tests pass. Typecheck clean. Build clean (`dist/assets/index-*.js 55.02KB gzip 15.04KB`, `index-*.css 8.99KB gzip 2.24KB`, built in 65ms). Catalogue validator green (40 entries).
- [x] Pre-push secret scan: no `ghp_|github_pat_|gho_|ghs_|ghu_|ghr_|bearer|api_key` patterns in diff.

### What's not done / caveats
- [ ] **Visual browser verification not performed by this session.** This environment has no browser automation (no Playwright, no MCP screenshot for web). Dev server was started and HTTP responses confirmed all-200 for `/`, `/src/main.ts`, `/data/*.json?import`; JS transform succeeded. The layout/colour/spacing correctness against DESIGN.md has NOT been eyeballed. Next session or user should run `pnpm dev`, open `http://localhost:5173`, and verify: dark bg, mono data, hero "96% clean" in teal, histogram shows the 5-bucket shape with 0-bucket dominant, ranked table 186 rows, paste-audit renders a real scorecard when CodePulse's own CLAUDE.md is pasted.
- [ ] LCP measurement (PRD AC: <2s) not measured. Lighthouse needed; user action.
- [ ] Issue #7 (deploy + domain + MOM) not started.
- [ ] "Eat own dog food" self-audit (paste CodePulse's own CLAUDE.md into the audit tool, capture score for launch narrative) — belongs in #7 MOM but is worth doing in next session as soon as visual verification confirms audit works.

### Decisions deferred (carried from session 6 tail)
- `/search/code` deprecation (2026-09-27) migration plan — post-launch.
- Catalogue breadth audit given 96%-scored-0 — decide before #7 launch.
- Drift-driven hourly commits — smallness threshold, not urgent.
- Slash-command extension research — still deferred from session 4.
- `robo-poet` smoke-test `no-emojis` hit — still flagged.
- `last_checked_at` in `meta.json` — revisit if UX needs it.

### NEXT action (for the next session)
1. **Open + review PR** for `feature/leaderboard-ui` → main. Inspect `DESIGN.md` for any house-style changes, scan the 5 new TS files for quality issues.
2. **Browser verification.** `pnpm dev`, load localhost, check the full page against DESIGN.md. Fix anything that drifts from the system (file as new commits on the same branch before merge).
3. **Once merged: Issue #7.** `docs/mom-v0.1.md` with the validation checklist (LCP <2s, zero runtime network calls, leaderboard populated, paste-audit works, architectural constraint tests pass, honest data not recalibrated). Deploy to Vercel. Point domain.
4. **Self-audit gate for #7.** Paste CodePulse's own `CLAUDE.md` into the deployed audit tool. Whatever it scores is in the launch post.

### File operations this session
- Created: `DESIGN.md`, `src/format.ts`, `src/format.test.ts`, `src/scorecard.ts`, `src/styles.css`, `src/leaderboard.ts`, `src/audit.ts`.
- Modified inside project: `src/main.ts`, `index.html`, `HANDOFF.md`.
- Modified outside project: 0.
- Deleted: 0.
- Committed secret values: 0.

### Git state
- Branch: `feature/leaderboard-ui` at 6 commits ahead of `main`, not yet pushed.
- `main` at `ddfd30c` (unchanged — merge pending review).
- No PR opened yet (will push + open PR after this HANDOFF commit).

---

## Session: 2026-04-17 (session 6 tail — PR #4 merged, hotfix, live data, thesis-check)

### What happened after PR #4 opened
1. **PR #4 merged** (`gh pr merge 4 --merge --delete-branch`) → merge commit `9dc4c21`.
2. **First `workflow_dispatch` FAILED.** Run `24539748665` died on code-search page 10 with 403 rate-limit-exceeded. Response header showed `x-ratelimit-limit: 10` on the `code_search` bucket (authenticated) — contradicts GitHub's doc claim of 30/min for authenticated code search. All 10 pages fired in ~8 seconds blew the 10/min budget.
3. **Hotfix shipped directly to main** (Phase 4 debug — authorised by just-merged context): `3e03b94 fix(refresh): throttle code-search pagination to 7s per page`. Adds a 7s sleep between pages 2–10 in `makeDiscover()`. Unit tests unchanged (rate-limit logic lives in CLI wiring, not `runRefresh`).
4. **Second `workflow_dispatch` SUCCESS.** Run `24539818762` completed in 5m35s. Data commit `94551ba data: refresh 2026-04-16T23:48:17Z` landed on main — 186 repos scored, `data/repos.json` + `data/meta.json` populated.
5. **Third `workflow_dispatch` SUCCESS (idempotency check).** Run `24540012331` completed in ~5min. Produced commit `722aac3` because the dataset genuinely drifted in 5 minutes: `alirezarezvani/claude-skills` went 11430→11431 stars, one new repo entered the 1000-hit code-search window, three low-star repos dropped out. `shouldWrite` contract holds (unit test for byte-exact equality still passes); real-world hourly runs will often commit because the source data is alive. Not a bug.

### Live data findings — BIG FINDING, honest-data rule in play
First full population of `data/repos.json` (186 repos, stars 3–43,573):

| Score bucket | Repo count | % |
|---|---|---|
| 0 | 179 | 96% |
| 1–25 | 7 | 4% |
| 26–50 | 0 | 0% |
| 51–75 | 0 | 0% |
| 76–100 | 0 | 0% |

- **Max score: 8/100** (`stillya/wg-relay`, 61 stars).
- **Foam (17,031 stars) scored 6.** If the cargo-cult thesis held, a repo at that popularity would expect visible redundancy. It didn't.
- The session-5 smoke test predicted this exact shape (9 of 10 scored 0). Data now confirms it at 186-repo scale.

**Implications for the v0.1 launch narrative (per the PRD's honest-data architectural constraint):** the thesis "redundancy concentrates in popular repos" is not supported. The top of the GitHub CLAUDE.md ecosystem is substantially cleaner than theorised. Either (a) the catalogue is too narrow / too strict and misses real redundancy, or (b) the popular corner of the ecosystem has self-selected for cleanliness, or (c) the cargo-cult framing was wrong.

The PRD's stance is explicit: *"If average redundancy across the top 200 is low (thesis wrong), ship the data as-is and adjust the launch narrative."* Launch narrative now shifts to: *"The top of the ecosystem is cleaner than expected — here's the distribution, and here's what remains redundant when it appears."* Data is the product regardless of which way it fell.

Worth considering before Issue #5/#6/#7:
- **Catalogue breadth audit.** Before launching a "surprisingly clean" narrative, sanity-check that the 40 entries aren't systematically missing common redundancy patterns (especially since session-5 dropped 5 over-matching entries). The 4% hit rate may be partially the catalogue's strictness.
- **Smoke-sample vs. top-stars divergence.** The `robo-poet` hit in session 5's smoke test (on a small/personal repo) is consistent with the finding: redundancy may concentrate in long-tail personal repos, not starred public ones. Interesting data point for the launch post.
- **Don't recalibrate the catalogue to manufacture scores.** PRD rule.

### Site / workflow state
- Workflow is on hourly cron (`0 * * * *`) and will fire automatically at each top-of-hour until disabled. Expect a new data commit ~every hour due to natural drift.
- Three data commits currently on main: `94551ba` (first populate), `722aac3` (idempotency run, drift).
- `main` at `722aac3`.
- No open branches.

### NEXT action (for the next session)
**Issue #5 — leaderboard UI** with explicit design-system pre-work first. Per user's brief (captured below):

1. **Establish `DESIGN.md`** before any component code. Available in-environment skills: `stitch-design`, `design-md`, `react-components`, `enhance-prompt`. Run `/stitch-design` first for 2–3 dashboard direction options, then `/design-md` to lock the chosen direction.
2. **Design brief (dark dashboard, data-forward):**
   - Dark theme mandatory. Developer monitoring dashboard.
   - Inspired by World Monitor (information density) + Linear (precision).
   - Accent colour signals health/diagnostic — not generic AI blue.
   - Typography: monospace for data, sans-serif for labels.
   - Visual language: health scores as red→amber→green gradients, sparklines for trends, compact data cards.
   - No decorative elements. Every pixel communicates data.
3. **Implement** with Vite + TS + vanilla DOM per PRD stack. (Stack confirmed by user: TypeScript first; Rust/Tauri is a future desktop-shell option, not v0.1.)
4. **Render the honest data story.** The UI must make it obvious that most repos score 0 — e.g., a distribution histogram alongside the ranked leaderboard, so "most CLAUDE.md files are clean" is a visible headline, not buried.

### "Eat own dog food" self-audit gate (Issue #7 MOM item)
Pre-launch: score CodePulse's own `CLAUDE.md` against the deployed catalogue. Whatever it scores, that's in the launch post. Authentic narrative.

### Open questions / decisions deferred
- **`/search/code` deprecation (2026-09-27).** Not a v0.1 blocker but requires a migration plan before it removes fields. Candidate migrations: GraphQL code search, Sourcegraph PublicAPI, or self-hosted indexer. Book for post-launch.
- **Catalogue breadth audit** before launch — consider whether another authoring pass is warranted given the 96%-scored-0 finding, or whether the data is honest as it stands.
- **Drift-driven commits** (every hour due to star ticks) — may want a small-diff threshold later if git history gets noisy. Not urgent.
- Slash-command extension research — still deferred from session 4.
- `robo-poet` smoke-test `no-emojis` hit — still flagged for future review pass.
- `last_checked_at` in `meta.json` — revisit only if UX wants fresher signal on no-op hours.

### File operations this session (full session including tail)
- Created: `scripts/refresh.ts`, `scripts/refresh.test.ts`, `.github/workflows/refresh.yml`.
- Modified inside project: `data/catalogue.json`, `scripts/validate-catalogue.ts`, `scripts/validate-catalogue.test.ts`, `src/score.ts`, `src/score.test.ts`, `package.json`, `pnpm-lock.yaml`, `docs/issues-v0.1-leaderboard-and-audit.md`, `HANDOFF.md`.
- Auto-created by Actions on main: `data/repos.json`, `data/meta.json` (via the scheduled-workflow commits `94551ba` and `722aac3` — authored by `codepulse-bot`, not by this session's local work).
- Modified outside project: 0.
- Deleted: 0 (local `feature/refresh-pipeline` branch was auto-cleaned by `gh pr merge --delete-branch`).
- Committed secret values: 0.

---

## Session: 2026-04-17 (session 6 — Issue #4 + schema prereq, PR #4 open)

### State at session start
- `main` at `0f2d1fd`, clean working tree.
- No open branches. `GH_TOKEN` already set as repo secret.
- Previous session's deferred decision: add `claude_code_version_verified_against` schema field before Issue #4. Confirmed at start of this session.

### Single deliverable for this session
Ship Issue #4 (GitHub Actions cron refresh pipeline) plus the flagged schema prereq. One PR, clearly-labelled commits, no stacked PRs.

### Design decisions locked with user
- **One PR for prereq + issue.** Schema bump isn't an issue, it's a prereq; ships in the same PR as Issue #4 with distinct labelled commits.
- **`repos.json` on `main`.** Skip the `data` branch dance per PRD. UI will fetch from `dist/data/`.
- **Idempotency option (a).** `runRefresh` only writes `repos.json` + `meta.json` when the repos array has changed; no-op hours leave git history untouched. Add `last_checked_at` later if UX needs fresher "checked at" signal.
- **`updated_at` bumped to today** (schema change, not content edit).
- **One authenticated Octokit client throughout.** Code search requires auth (`/search/code` returns 401 unauthenticated); HANDOFF's previous "code search stays unauthenticated" note was factually wrong and is corrected in-PR.

### What happened
1. Schema prereq shipped TDD:
   - `4cbb70b test: require claude_code_version_verified_against in catalogue schema` (RED — 2 of 3 new validator tests failing).
   - `8321470 feat(schema): add claude_code_version_verified_against to catalogue` — Pattern type updated, validator enforces ISO date, all 40 entries backfilled with `2026-04-16` (the date they were sourced against Piebald/Anthropic), catalogue `version` 1 → 2, `updated_at` → `2026-04-17`. GREEN.
2. Issue #4 shipped TDD:
   - `dc57122 test: failing tests for refresh pipeline` — 13 tests for `scoreRepo`/`shouldWrite`/`runRefresh` with injected Octokit + fs mocks. RED (module doesn't exist).
   - `d30ad7b feat: refresh pipeline (scoreRepo, shouldWrite, runRefresh)` — three pure/testable seams + CLI wiring with authenticated Octokit. GREEN.
   - `4455cad chore: pnpm refresh script wires scripts/refresh.ts` — npm script fix-up (missed from previous commit because Edit tool required a fresh Read of package.json).
3. Workflow YAML:
   - `4ab084b ci: hourly refresh workflow — Issue #4` — `.github/workflows/refresh.yml` runs on cron `0 * * * *` + `workflow_dispatch`. `concurrency` group prevents overlap, 15-min timeout, `contents: write` permission for the data commit. Uses `GH_TOKEN` PAT for refresh's API calls; `GITHUB_TOKEN` (default) for the commit push.
4. AC doc update:
   - `88dd17d docs: revise Issue #4 rate-limit AC — honest-data rule`.

### Revised rate-limit AC (honest-data rule)
Original AC target `<500 calls per run` was set under a false assumption that GitHub code search supports `sort:stars-desc`. It doesn't, and code-search results don't carry `stargazers_count` inline. A faithful top-200-by-stars therefore costs:
- Code search discovery (paginate up to 1000 hits): ~10 calls
- `repos.get` star enrichment per unique repo: ~500–1000 calls
- Content + last-commit per winner: 200 × 2 = 400 calls
- **Total: ~1000–1400 calls per run** — well under the 5000/hr authenticated hard limit.

Per PRD's honest-data rule: ship the real cost rather than shrink the dataset to hit an arbitrary number. Issues doc + PR description both updated.

### What's done this session
- [x] Schema prereq shipped (2 commits, TDD).
- [x] Issue #4 shipped (3 commits, TDD).
- [x] Workflow YAML shipped (1 commit).
- [x] AC doc revised (1 commit).
- [x] 50/50 tests pass. Typecheck clean. Validator green. Build clean (29ms).
- [x] Pre-push secret scan: no `ghp_|github_pat_|bearer|api_key` patterns in diff.
- [x] PR #4 opened: https://github.com/Neelagiri65/codepulse/pull/4

### What's not done
- [ ] **Manual `workflow_dispatch` smoke test of the refresh Action.** Must be done AFTER PR #4 merges to `main` (workflow file needs to exist on the default branch). Verify `data/repos.json` populates with 200 entries; run a second manual refresh and confirm zero diff (idempotency).
- [ ] Issue #5 (leaderboard UI) and issues #6–7.

### Design-system pre-work for Issue #5 (user direction, captured for next session)
Before writing any Issue #5 UI, establish design language rather than drift into AI-default styling. User's brief:
- Dark theme mandatory (monitoring dashboard used by developers).
- Information-density + precision (reference points: World Monitor, Linear).
- Accent colour: signals "health/diagnostic," not generic AI blue.
- Typography: monospace for data, clean sans-serif for labels.
- Visual language: health scores as red→amber→green gradients, sparklines for trends, compact data cards.
- No decorative elements. Every pixel communicates data.

**Environment substitutes (flagged during the session):** the brief referenced `/mnt/skills/public/frontend-design/SKILL.md`, which is a Linux sandbox path not present on this darwin environment. Available in-environment design skills are `stitch-design`, `design-md`, `react-components`, `enhance-prompt`. Issue #5 session should:
1. Start with `/stitch-design` to generate 2-3 radically different dashboard directions.
2. Use `/design-md` to lock the chosen direction into `DESIGN.md` at project root.
3. Use `/react-components` to translate designs into Vite + TS components against `DESIGN.md`.

User also flagged: if Stitch is available in the CC environment, use it for any chart/viz rendering while CC handles data + logic. (Stitch MCP tools ARE available in this environment — confirmed.)

### "Eat own dog food" self-audit gate for Issue #7 (launch)
Pre-launch MOM check, added by user: run CodePulse's own catalogue against CodePulse's own CLAUDE.md (the project file, not the global rules). If CodePulse scores high on its own metric, that's the launch narrative: *"we built the tool that measures AI config health, our own config scored N/100 on the first audit, here's what we learned."* Add as an explicit item in `docs/mom-v0.1.md` when Issue #7 lands.

### NEXT action (for the next session)
1. **Review PR #4** on GitHub. If the commit-by-commit TDD flow is clean and the schema/refresh/YAML all look right, merge. One-issue-per-PR rule: merge before branching #5.
2. **Post-merge: manual `workflow_dispatch` smoke test** of the refresh Action. Visit Actions tab → refresh → Run workflow. Expect ~5-min run; data commit appears on `main` if 200 repos scored successfully. Run it again immediately; second run should produce zero diff (idempotency).
3. **Then Issue #5** — UI + design system. First step per global rules Phase 3: run `/stitch-design` or `/design-md` to establish `DESIGN.md` before any component code. See design-pre-work section above for the user's brief.

### Open questions / decisions deferred
- `scorecard.skipped` UI surface (Issue #5/#6) — still open.
- Domain (Issue #7) — still deferred.
- `last_checked_at` field in `meta.json` — revisit if UX wants fresher signal on no-op hours.
- Slash-command extension research (`/compact`, `/btw`, `/hooks`, `/context`, `/init`, `/rewind`) — still deferred from session 4.
- `robo-poet.md` smoke-test hit on `no-emojis` — still flagged for future review pass.

### File operations this session
- Created: `scripts/refresh.ts`, `scripts/refresh.test.ts`, `.github/workflows/refresh.yml`.
- Modified inside project: `data/catalogue.json` (schema field on all 40 entries, version 1→2, updated_at → 2026-04-17), `scripts/validate-catalogue.ts`, `scripts/validate-catalogue.test.ts`, `src/score.ts`, `src/score.test.ts`, `package.json`, `pnpm-lock.yaml`, `docs/issues-v0.1-leaderboard-and-audit.md`, `HANDOFF.md`.
- Modified outside project: 0.
- Deleted: 0.
- Committed secret values: 0.

### Git state
- Branch: `feature/refresh-pipeline` at 7 commits ahead of `main`, pushed.
- `main` at `0f2d1fd` (unchanged — merge pending PR review).
- PR #4: https://github.com/Neelagiri65/codepulse/pull/4

---

## Session: 2026-04-17 (session 5 tail — PR #3 merged + Issue #4 pre-flight)

### What happened after the session-5 over-match audit
- PR #3 merged into `main` at `72de464` (merge commit, not squash).
- PRs #1 and #2 were already merged; `gh pr merge 1/2` would have errored.
- `feature/catalogue` deleted locally and on remote.
- Pre-push secret scan: no `ghp_|github_pat_|gho_|ghs_|ghu_|ghr_|bearer` patterns in any commit on this branch. Clean.
- **`GH_TOKEN` Actions secret set on `Neelagiri65/codepulse`** (timestamp `2026-04-16T23:10:40Z`). Sourced from Keychain entry `github-pat` via the extended `~/.secrets/populate-env.sh codepulse`. Value never entered chat, argv, disk, or shell history — Keychain → pipe → `gh secret set` stdin → GitHub sealed-box.
- `~/.secrets/populate-env.sh` extended with a `codepulse` case that runs the pipe above. `~/.secrets/MANIFEST.md` updated to document the new command. Both are outside the project dir.

### Issue #4 pre-flight — now fully unblocked
- `main` is clean and at `72de464`.
- `GH_TOKEN` is set on the repo (verify with `gh secret list --repo Neelagiri65/codepulse`).
- No feature branches outstanding.
- Catalogue stands at 40 validated entries; smoke test harness at `scripts/smoke-test.mts`.

### NEXT action (fresh session for Issue #4)
Start from `main`, branch as `feature/refresh-pipeline` (or similar). Build the GitHub Actions cron that refreshes the leaderboard JSON. Architectural constraint: the refresh runs *only* in CI on schedule — no local/dev writes to the leaderboard. The Action uses `secrets.GH_TOKEN` for raw-file fetches (to dodge unauth 5-req/min limit); code-search stays unauthenticated.

### File operations this session tail
- Modified inside project: `HANDOFF.md` (this block).
- Modified outside project: `~/.secrets/populate-env.sh`, `~/.secrets/MANIFEST.md` — both explicitly authorised, part of the sanctioned secrets-management standard, not the project directory.
- Deleted: `feature/catalogue` (local + remote branch).
- Committed secret values anywhere: **none**.

---

## Session: 2026-04-16 (session 5, PR #3 review — over-match audit)

### State at session start
- `feature/catalogue` at `89c2508`, PR #3 open with 45 sourced entries awaiting review.
- Next action from session 4: entry-by-entry review using the checklist in `docs/catalogue-authoring.md`.

### Single deliverable for this session
Audit the 45 catalogue entries for over-matching risk. Drop or tighten any entry that would fire on legitimate, non-redundant CLAUDE.md content. Ship a credible catalogue before Issue #4's crawl.

### What happened
Over-match audit flagged 7 false-positive risks. User triaged:
- **Dropped 5 (hardening / project-specific ≠ redundancy):** `no-force-push`, `no-reset-hard` (stricter-than-default is hardening), `be-direct` (fires on narrative prose), `no-sql-injection`, `no-xss` (fire on project-specific security contracts).
- **Tightened 4 regexes** to match generic restatement only, not project-scoped variations:
  - `no-comments` — require explicit verb + plural `comments` + lookahead blocking prepositions (`in|to|on|for|out|when|without|unless|except|inside|across|that|but`).
  - `parallel-tool-calls` — negative lookbehind on `not|don't|never|avoid|disable|skip`; affirming verb list; trailing `except|unless|but` lookahead.
  - `no-unnecessary-error-handling` — qualifier required (`unnecessary|excessive|over-engineered|premature`).
  - `verify-your-work` — must terminate on sentence boundary or generic completion verb.
- **Ground rule added** to `docs/catalogue-authoring.md`: "Hardening is not redundancy." Future entries targeting destructive ops or security must require evidence the instruction is no stricter than the default.
- **`scripts/smoke-test.mts` committed** as a permanent validation tool. Runs catalogue against a directory of real CLAUDE.mds and prints excerpts for human review.

### Smoke-test finding (important for launch narrative)
Proposed 40-entry catalogue run against 10 random public CLAUDE.mds (3–11 KB each). **9 of 10 scored 0.** Only `robo-poet.md` hit (`no-emojis` on "No emojis in commit messages," w=6, score 3).

**Reading:** the sample was biased toward small/personal repos. Redundancy bloat likely concentrates in popular/copied repos and power-user accumulations — which is exactly what Issue #4's top-200-by-stars crawl will measure. Launch narrative sharpens: "redundancy concentrates in the most-copied repos, the ones that influence the rest of the ecosystem." More credible than "everything is broken."

### What's done this session
- [x] Over-match audit — 7 risks identified, 5 dropped + 4 tightened per user triage.
- [x] Regex test harness at `/tmp/codepulse-regex-test.mjs` — all positive/negative cases pass.
- [x] 10 real CLAUDE.mds fetched via `gh api` to `/tmp/codepulse-samples/`.
- [x] Proposed catalogue validated (40 entries, validator clean).
- [x] Full test suite green (34/34). Typecheck clean.
- [x] 3 commits pushed on `feature/catalogue`:
  - `2fb7da8 fix(catalogue): drop 5 overmatching entries, tighten 4 regexes — PR #3 review`
  - `c40f235 docs: add "Hardening is not redundancy" rule to catalogue-authoring`
  - `5a11bc0 tool: scripts/smoke-test.mts — score catalogue against real CLAUDE.md samples`

### What's not done
- [ ] **Entry-by-entry review of the remaining 40.** Over-match was the first credibility risk addressed; still open: `source_url` reachability, whether linked text actually supports the claim, weight proportionality, and "would a developer agree they've been wasting tokens?"
- [ ] Issue #4 (GH Actions cron refresh pipeline) and Issues #5–7.
- [ ] `robo-poet.md` hit — `no-emojis` fires on "No emojis in commit messages"; debatable (scoped to commit messages, not blanket). Flag for future pass, not blocking.

### NEXT action (for the next session)
**Option A — finish PR #3 review:** continue entry-by-entry against the remaining 40 on the other three checklist items (URL reachability, claim support, weight). Merge PR #3 when done.

**Option B — ship PR #3 as-is and move to Issue #4:** the over-match pass was the highest-credibility risk. If the remaining review can wait until after the top-200 crawl surfaces real data (which will also flag weak entries empirically), merge now and start Issue #4.

User's call. Before starting #4, set `GH_TOKEN` as a GitHub Actions repo secret (classic PAT, public-repo read scope).

### Open questions / decisions deferred
- `scorecard.skipped` UI surface (Issue #5/#6) — still open.
- Domain (Issue #7) — still deferred.
- `claude_code_version_verified_against` schema field for stale-entry flagging — decide before Issue #4.
- Slash-command extension (`/compact`, `/btw`, `/hooks`, `/context`, `/init`, `/rewind`) — still deferred from session 4's mid-research compaction. Canonical source: `code.claude.com/docs/en/commands`.
- v0.2 territory: custom-skills redundancy (`/mom`, `/session-start`, `/research-first`) — project-local, not native, out of scope.

### File operations this session
- Created: `scripts/smoke-test.mts`.
- Modified: `data/catalogue.json` (45 → 40 entries, 4 regexes tightened), `docs/catalogue-authoring.md` (ground rule added), `HANDOFF.md`.
- Deleted: 0.
- Touched outside project dir: 0 (all /tmp work was temporary artefacts; gh api fetches were read-only).

### Git state
- Branch: `feature/catalogue` at `5a11bc0`, pushed.
- `main` at `4fa8156` (unchanged).
- Remote: https://github.com/Neelagiri65/codepulse
- PR #3: https://github.com/Neelagiri65/codepulse/pull/3 (auto-updated with 3 new commits).

---

## Session: 2026-04-16 (session 4, Issue #3 catalogue seed — hybrid authoring)

### State at session start
- `main` at `4fa8156` — PR #2 (`score()`) squash-merged at session open, `feature/score` deleted.
- Working on `feature/catalogue`, branched off clean `main` (no stacking).
- `src/score.ts` already consumes the flat Issue #3 catalogue schema, so #3 is pure content + validation work.

### Single deliverable for this session
Issue #3 — seed `data/catalogue.json` with redundancy entries sourced from (1) Piebald's publicly visible system prompt components, (2) Anthropic's Claude Code best-practices doc at `code.claude.com/docs/en/best-practices`, and (3) top-starred public `CLAUDE.md` files. Plus: `scripts/validate-catalogue.ts` (schema + non-empty `source_url` gate) and `docs/catalogue-authoring.md` (sourcing rules).

**Quality > count.** Target 50 entries if defensible; if I can't source 50 with real URLs, I ship fewer and flag the gap honestly rather than fabricate filler. The user reviews every entry manually and closes the gap from their own repo/forum experience.

### Design decisions locked in
- **Hybrid authoring.** Agent drafts from the three source classes above; user reviews and rejects/edits/adds before ship. Agent's draft is never treated as final — every entry's source_url must load and support the claim under manual review.
- **Schema (already locked by `src/score.ts`):** `{ id, match_type: "phrase"|"regex", match_value, weight: 1–10, source_url, reason, added_at }`. Any entry missing a verifiable `source_url` is rejected by the validator.
- **Sourcing rules (to be written to `docs/catalogue-authoring.md`):**
  - Only three source classes accepted: Anthropic docs, Piebald publicly visible catalogue/system-prompt references, observed-in-repo with an explicit repo URL.
  - "This seems redundant" is never acceptable. A defensible claim looks like: *"Anthropic says X; the pattern instructs Y which duplicates X."*
  - If a top-repo `CLAUDE.md` asserts a behaviour that contradicts a Claude Code default, flag it as redundant only if the default is documented — the doc URL is the citation, not the repo.
- **Validator:** `pnpm validate:catalogue` fails if any entry is missing a required field, has `weight` outside 1–10, uses an unknown `match_type`, has a duplicate `id`, or has an empty `source_url`. URL reachability is manual (out of scope for CI — network flakiness would break builds).

### Branch + PR strategy
- PR #2 squash-merged at session open.
- Standing rule: merge each issue's PR to `main` before branching the next. No stacked PRs.

### Planned work order
1. HANDOFF update (first commit — this one).
2. Research: WebFetch the best-practices doc; find Piebald public system-prompt components; identify top-starred `CLAUDE.md` files.
3. TDD `scripts/validate-catalogue.ts`: failing test → implement → green.
4. Draft `data/catalogue.json` from research, one entry at a time, each with a real source_url.
5. Write `docs/catalogue-authoring.md` so the rules outlive this session.
6. PR #3 opens; user reviews every entry manually before merge.

### What's done this session
- [x] PR #2 squash-merged into `main`, remote branch deleted.
- [x] `feature/catalogue` branched off clean `main`.
- [x] HANDOFF.md updated as first commit (`d66d075`).
- [x] Research: Anthropic best-practices doc fetched and distilled; Piebald system-prompts repo at `Piebald-AI/claude-code-system-prompts` confirmed publicly readable; 8 specific prompt files quoted for source text; calibration pass against 22,096 real CLAUDE.md files (e.g. "be concise" appears in 2,800 public files — the thesis has empirical support).
- [x] Failing tests for `scripts/validate-catalogue.ts` committed red (`ebd8d4f`) — 16 cases.
- [x] Validator implemented green (`8e1734c`). `pnpm validate:catalogue` works (tsx). 34/34 tests pass, typecheck clean.
- [x] Catalogue drafted (`93dee79`) — **45 sourced entries**, each citing a Piebald system-prompt file or the Anthropic best-practices doc. Smoke test against a synthetic redundant fragment produces score 21/100 with 7 matched IDs — end-to-end works.
- [x] `docs/catalogue-authoring.md` written (`d9444c7`) — three admissible source classes, weight scale, regex safety rules, review checklist, honest-data rule.
- [x] PR #3 opened: https://github.com/Neelagiri65/codepulse/pull/3

### What's not done
- [ ] **User review of every catalogue entry.** Agent's draft is never final per the architectural constraint.
- [ ] Issue #4 (GH Actions cron refresh pipeline) and Issues #5–7.

### NEXT action (for the next session)
**Review PR #3 entry-by-entry.** Use the checklist in `docs/catalogue-authoring.md` under "Reviewing someone else's entry." For each of the 45 entries:
1. Does the `source_url` load?
2. Does the linked text actually support the claim?
3. Is `match_value` specific enough to avoid over-matching benign prose?
4. Is `weight` proportional?

Reject stretches. Add entries from your own repo/forum experience (candidates: patterns you have seen in the SheetPortal / ContextKey / CashlessNow CLAUDE.mds, or recurring forum posts). Agent aimed for 50 and shipped 45 — the gap is the user-authored slice.

**Slash-command extension — scoped but not written.** User flagged native slash commands (/compact, /btw, /plan, /context, /agents, /advisor, /hooks, /init, /rewind) as a high-confidence redundancy vector. Existing catalogue already covers /clear (`clear-between-tasks`), Plan Mode (`use-plan-mode`, `explore-first-then-code`), /agents (`use-subagents-for-research`). Gaps still open: /compact, /btw, /hooks, /context, /init, /rewind, and /advisor if verifiable. Session ended before these were authored — conversation compacted mid-research, user called it and asked for a fresh session. Resume in fresh session starting from `code.claude.com/docs/en/commands` as the canonical source.

After PR #3 merges: Issue #4. Before starting #4, set `GH_TOKEN` as a GitHub Actions repo secret manually (classic PAT, public-repo read scope is enough; the refresh script stays unauthenticated for code search but authenticated for raw file fetches to avoid 5-req/min limits).

### Open questions / decisions deferred
- Does `scorecard.skipped` surface in the UI (Issue #5/#6)? — still open.
- Domain (Issue #7) — still deferred.
- Should the catalogue carry a `claude_code_version_verified_against` field so stale entries are flagged automatically? Decide before Issue #4 if yes; it would be a lightweight schema bump.
- v0.2 territory: custom skills (/mom, /session-start, /research-first) are project-local, not native — they are not catalogue candidates. Flagged by user for future evaluation of native-vs-custom skill redundancy.

### Git state
- Branch: `feature/catalogue` at `d9444c7`, pushed after this commit, PR #3 opens.
- `main` at `4fa8156`.
- Remote: https://github.com/Neelagiri65/codepulse
- Commits on `feature/catalogue` ahead of main:
  - `d66d075 docs: handoff — session 4 open, Issue #3 hybrid authoring`
  - `ebd8d4f test: failing tests for validate-catalogue — Issue #3 red`
  - `8e1734c feat: validate-catalogue.ts + pnpm validate:catalogue — Issue #3 green`
  - `93dee79 feat: seed catalogue with 45 sourced redundancy entries — Issue #3`
  - `d9444c7 docs: catalogue-authoring rules — Issue #3`
  - plus this HANDOFF commit

### File operations this session
- Created: `scripts/validate-catalogue.ts`, `scripts/validate-catalogue.test.ts`, `docs/catalogue-authoring.md`.
- Modified: `HANDOFF.md`, `data/catalogue.json` (45 entries added), `package.json` (tsx + validate script), `pnpm-lock.yaml`.
- Deleted: 0.
- Touched outside project dir: 0 (Piebald/Anthropic fetches were read-only).
