# CodePulse — Project Instructions

## First read, in order
1. `docs/prd-v0.1-leaderboard-and-audit.md` — the single approved scope for now
2. `docs/issues-v0.1-leaderboard-and-audit.md` — ordered work breakdown
3. `HANDOFF.md` — where the last session ended
4. `CODEPULSE_V2_FULL_SPEC.md` — north-star vision, not a build plan. Do not build phases from this file.

## Non-negotiables (architectural constraint tests)
- No per-audit LLM calls. Scoring is deterministic, catalogue-based, runs identically in the browser and in the GitHub Action.
- No auth, no cookies, no server-side database, no analytics that phone home.
- Leaderboard is only written by the scheduled GitHub Action. No write endpoints.
- The redundancy catalogue only contains entries with a verifiable source URL. No "seems redundant" entries.
- If the data disproves the thesis, ship the data honestly and adjust the narrative. Never recalibrate the catalogue to manufacture a result.

## Stack (for v0.1)
- Vite + TypeScript + vanilla DOM, static build, deployed on Vercel hobby.
- GitHub Actions cron for the refresh pipeline.
- Static JSON as the data layer. No Postgres, no Redis yet.
- Vitest for unit tests.

## Build discipline
- One issue per session. Don't merge multiple issues into one PR.
- TDD per global rules: failing test first, commit, then implement, commit.
- Commit after every successful step. Never commit broken code.
- Update `HANDOFF.md` at session end with state + next action.

## Out of scope for v0.1 (in the V2 spec, not now)
Globe, cargo-cult arcs, historical backfill, time-travel, per-model scoring, Piebald version-decay, community, OAuth, public API, SSE, live feed, plugins, badges, course audits, mobile polish.
