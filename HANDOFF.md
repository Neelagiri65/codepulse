# HANDOFF — CodePulse

## Session: 2026-04-16 (session 3, Issue #2 scoring function)

### State at session start
- `main` at `813241f` — PR #1 (scaffold) squash-merged at session open, `feature/scaffold` deleted.
- Working on `feature/score`, branched off clean `main` (no stacking).
- Vite + TS + vitest toolchain live; `data/*.json` empty skeletons in place.

### Single deliverable for this session
Issue #2 — pure `score(content, catalogue)` function with unit tests. No I/O. Deterministic. ≥90% line coverage on `src/score.ts`. Same function will run in the GH Action (#4) and in the paste-audit UI (#6).

### Design decisions locked in
- **Catalogue entry schema (flat, per Issue #3):** `{ id, match_type: "phrase" | "regex", match_value, weight: 1–10, source_url, reason, added_at }`. `score()` consumes this shape directly — Issue #3 just populates the array.
- **Scoring formula:** `redundancyScore = round((Σ weights of matched patterns) / (Σ weights of all catalogue patterns) × 100)`. Empty catalogue → `0`. Each pattern contributes its weight once per scorecard whether it matches one or many times (the catalogue entry is the unit, not the occurrence).
- **Matching:** case-sensitive by default. `phrase` = substring `includes()`. `regex` = `new RegExp(value)`; pattern authors embed their own flags in the value string if needed (v0.1 ignores author-supplied flags — `new RegExp(value)` only).
- **Excerpt:** first-occurrence context, ±40 chars, single line collapsed.
- **Token cost:** `Math.ceil(content.length / 4)`.
- **Bad regex handling:** invalid `match_value` → pattern is skipped and reported on `scorecard.skipped`, so one malformed entry does not brick a leaderboard run.

### Branch + PR strategy
- Standing rule: merge each issue's PR to `main` before branching the next. No stacked PRs.
- PR #1 squash-merged at session open.

### What's done (this session, updated live)
- [x] PR #1 squash-merged into `main`, remote branch deleted.
- [x] `feature/score` branched off clean `main`.
- [x] HANDOFF.md rewritten as first commit (failure-mode #4 guard — stale HANDOFFs after compaction are exactly the failure we are avoiding).
- [ ] Failing tests for `score()` committed red
- [ ] `score()` implemented, all tests green
- [ ] Coverage check ≥90% on `src/score.ts`
- [ ] PR #2 opened against `main`

### NEXT action (for the next session)
If Issue #2 ships: merge PR #2, then Issue #3 — seed the 50-entry redundancy catalogue with verifiable source URLs. Issue #3 is the critical-path content work and benefits from the user's own domain judgement, not agent drafting alone. Decide the authoring split (user / agent / hybrid) before writing any entries.

If Issue #2 does not ship this session: resume `feature/score`, finish the remaining test-or-implementation step, open PR #2.

### Open questions / decisions deferred
- Domain (`codepulse.dev` vs `*.vercel.app`) — still deferred to Issue #7.
- Catalogue authoring split for Issue #3 — decide at session start.
- Whether the UI exposes `scorecard.skipped` to end users vs just logging — decide in Issue #5/#6.

### Git state
- Branch: `feature/score` off `main` (`813241f`)
- Remote: https://github.com/Neelagiri65/codepulse
- PR #1 merged as of this session

### File operations this session
(updated at session end)
