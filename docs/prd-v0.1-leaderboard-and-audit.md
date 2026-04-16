# PRD — CodePulse v0.1: Leaderboard + Paste-Audit

**Status:** Draft, awaiting user approval
**North star:** `CODEPULSE_V2_FULL_SPEC.md` (vision, 996 lines, do not try to build all of it)
**This PRD covers only:** the narrowest slice that proves the thesis and ships to Vercel in 2–3 sessions.

## Problem Statement

Developers copy popular `CLAUDE.md` files from starred GitHub repos without measuring whether those configs help or hurt. Claude Code ships updates multiple times per week; configs rot silently. Nobody audits this at ecosystem scale. Today a developer has no way to ask *"is my CLAUDE.md actually helping?"* and get a grounded answer.

## User Story

As a developer curious whether my CLAUDE.md is helping, I want to (a) see a public leaderboard of top public `CLAUDE.md` files scored for redundancy against documented Claude Code defaults, and (b) paste my own config for an instant score — so I can decide what to trim without installing anything.

## Acceptance Criteria

1. Static site deployed on Vercel, single URL, LCP under 2 seconds on a fresh load.
2. Leaderboard shows 200 public repos containing `CLAUDE.md` at repo root, ranked by redundancy score (worst first).
3. Each row shows: owner/repo, stars, `CLAUDE.md` char count, redundancy score (0–100), last-commit date to `CLAUDE.md`, a "matched patterns" count.
4. A textarea on the same page accepts pasted `CLAUDE.md` content and renders the same scorecard client-side, using the same scoring function as the leaderboard.
5. Data refreshed hourly via a GitHub Actions cron workflow; site displays the last-refresh timestamp.
6. The redundancy catalogue (`data/catalogue.json`) is human-readable, in-repo, and each entry cites its source (Anthropic doc URL or observed-in-top-repo note).
7. No auth, no cookies, no third-party analytics. The site makes zero network calls after loading its own static assets.
8. Repo is public, AGPL-3.0, and a third party can reproduce the leaderboard by re-running `scripts/refresh.ts` against the current catalogue.

## Technical Approach

**Stack:** Vite + TypeScript + vanilla DOM (no framework). Deploy: Vercel hobby tier as static output.

**Data layout (all static JSON, in-repo):**
- `data/catalogue.json` — list of ~50 redundancy patterns, each: `{ id, match: {type: "regex"|"phrase", value}, weight, source_url, reason }`
- `data/repos.json` — written by the GitHub Action: `{ refreshed_at, repos: [{ owner, name, stars, size, last_commit_at, score, matches: [pattern_id] }] }`
- `data/meta.json` — `{ tool_version, catalogue_version, last_refresh_at }`

**Scoring function** (`src/score.ts`): pure function, no I/O.
```
score(content: string, catalogue: Pattern[]) -> {
  redundancyScore: number,  // 0–100, weighted sum of matched patterns / total possible weight, normalised
  matches: Array<{ patternId, excerpt, weight }>,
  tokenCost: number          // chars / 4 approximation
}
```
Identical function runs server-side (GitHub Action) and client-side (paste-audit). One source of truth.

**Refresh pipeline (`scripts/refresh.ts`):**
1. GitHub code search: `filename:CLAUDE.md path:/` sorted by stars, take top 200 repos.
2. For each repo, fetch raw `CLAUDE.md` via `api.github.com/repos/{owner}/{name}/contents/CLAUDE.md`.
3. Call `score(content, catalogue)`, append to `repos.json`.
4. Commit the updated `data/*.json` to the repo on a `data` branch.
5. Rate-limited to stay under 5,000 req/hr (200 calls per refresh, run hourly = 200/hr — comfortable).

**Catalogue authoring (the actual hard work):** seed ~50 entries by hand. Sources: Anthropic's published best-practices doc, the Piebald public catalogue (read-only, no republishing), spot-checks of the top 20 CLAUDE.md files on GitHub. Each entry must have a verifiable source URL; entries with fuzzy justification are rejected.

## Architectural Constraint Test

Non-negotiables for v0.1 — any design choice that violates these gets rejected:

- **No per-audit LLM calls.** Both leaderboard scoring and paste-audit must run with zero network calls to Claude/OpenAI/etc. Only the catalogue file is fetched; scoring is local.
- **No private data stored.** No auth, no cookies, no server-side database. If a user pastes a config, it stays in their browser.
- **Leaderboard is not writable from the frontend.** `repos.json` is only produced by the scheduled GitHub Action. No API endpoint accepts writes.
- **Reproducibility.** Third party runs `scripts/refresh.ts` with the same catalogue → gets the same `repos.json` (modulo new commits). The scoring is deterministic.
- **Honest data.** If average redundancy across the top 200 is low (thesis wrong), ship the data as-is and adjust the launch narrative. No recalibrating the catalogue to manufacture a bigger number.

These are verified in the MOM check before launch. Any violation blocks the deploy.

## Out of Scope (explicitly, for v0.1)

Globe / 3D viz; cargo-cult propagation arcs; historical backfill and time-travel UI; per-model scoring (Sonnet / Opus / Haiku breakdown); Piebald version-decay tracking; community / comments / voting; GitHub OAuth; public API, SSE, live feed; tool plugins (Cursor, Copilot, Windsurf); badges, embeds, widgets; course audits; token-cost dollar calculator; mobile polish (mobile usable, not pretty); any write endpoints; desktop app.

All of these are real and valuable — they belong in the V2 spec phases. They do not belong in v0.1.

## Dependencies

- GitHub personal access token (public-repo read scope), stored as `GH_TOKEN` in GitHub Actions secrets.
- Vercel project linked to the repo.
- Domain (`codepulse.dev` or subdomain) pointed at Vercel — deferrable; can launch on vercel.app subdomain first.
- Hand-authored catalogue of ~50 entries — this is the critical path item and the thing easiest to under-invest in.

## Estimated Complexity

**Medium.** The infra is boring (Vite + GH Actions + static JSON). The catalogue-authoring is where the quality of the product lives and where shortcuts show up in the final score. Budget 2–3 focused sessions:
- Session A: scaffold + scoring function + tests + empty catalogue.
- Session B: catalogue authoring (50 entries with sources).
- Session C: refresh pipeline + UI + deploy + MOM.

## What v0.1 Proves

If redundancy scores cluster high across top repos → thesis holds, launch narrative is *"cargo cult confirmed."*
If scores cluster low → thesis is wrong, launch narrative is *"the top of the ecosystem is cleaner than expected; here's the distribution."* Either way the data is the product.
