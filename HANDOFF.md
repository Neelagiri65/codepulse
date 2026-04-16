# HANDOFF — CodePulse

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
