# HANDOFF — CodePulse

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
