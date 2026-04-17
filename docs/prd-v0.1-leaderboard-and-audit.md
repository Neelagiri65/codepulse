# PRD — CodePulse v0.1: Leaderboard + Paste-Audit

**Status:** Draft, awaiting user approval
**North star:** `CODEPULSE_V2_FULL_SPEC.md` (vision, 996 lines, do not try to build all of it)
**This PRD covers only:** the narrowest slice that proves the thesis and ships to Vercel in 2–3 sessions.

## Problem Statement

**Original thesis (pre-2026-04-17):** developers copy popular `CLAUDE.md` files
from starred GitHub repos without measuring whether those configs help or hurt;
configs rot silently; most of the ecosystem is bloated.

**Revised thesis (locked 2026-04-17 after two empirical checks):** the bloat
claim is too strong. After a v3 catalogue of 82 regex patterns re-scored the top
185 public `CLAUDE.md` files, the distribution was `[185, 0, 0, 0, 0]` with max
score 7 — effectively nobody scored as redundant. A manual read of 5 zero-scoring
large files (10k–44k chars) then established the true shape of the problem:

- 1 of 5 (`zenml-io/zenml`) contained **heavy invisible redundancy**:
  paraphrased semantic duplicates of Claude Code defaults (commenting policy,
  commit message guidelines, bug-fix approach, task-planning steps). All five
  redundancies are phrased differently enough that no regex catches them.
- 3 of 5 were **legitimately clean**: their size came from project-specific API
  tables, architecture docs, and build/test command references — not redundancy.
- 1 of 5 was mostly clean with one borderline section.

See `docs/ground-truth-2026-04-17.md` for the file-by-file findings and the
specific redundancies the LLM layer must catch.

This reshapes the product. The question a developer actually needs answered is
not *"is CLAUDE.md bloat a widespread problem?"* (it isn't, at the ecosystem
level) but *"is **my** CLAUDE.md in the quiet 80% that's fine, or the noisy 20%
that's silently bloated with paraphrased defaults?"* That's a different
question, and it can only be answered by semantic analysis — regex can't tell
the two categories apart.

CodePulse becomes the instrument that answers that question honestly: a
leaderboard of public configs scored both deterministically (regex catalogue)
and semantically (LLM enrichment in CI), plus a paste-audit that scores the
developer's own file on the same deterministic catalogue (with a visible label
that the semantic layer is leaderboard-only).

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

- **No per-audit LLM calls from the browser.** Paste-audit must run with zero network calls to Claude/OpenAI/etc. The browser reads only the static catalogue + cached scores; scoring is local.
- **No private data stored.** No auth, no cookies, no server-side database. If a user pastes a config, it stays in their browser.
- **Leaderboard is not writable from the frontend.** `repos.json` is only produced by the scheduled GitHub Action. No API endpoint accepts writes.
- **Reproducibility for the deterministic layer.** Third party runs `scripts/refresh.ts` with the same catalogue against GitHub at rest → gets the same deterministic score in `repos.json` (modulo new commits).
- **Honest data.** If average redundancy across the top 200 is low (thesis wrong), ship the data as-is and adjust the launch narrative. No recalibrating the catalogue to manufacture a bigger number.

### v0.1.x amendment — CI-only LLM enrichment (locked 2026-04-17, session 7 tail)

The original constraint "no per-audit LLM calls" is tightened to "no per-audit LLM calls **from the browser**." The GitHub Action is allowed a semantic-enrichment call to the Claude API, subject to these rules (any violation blocks the deploy):

- **CI only.** LLM calls happen inside the refresh Action. API keys live in `secrets.ANTHROPIC_API_KEY`. They never ship to the client; no proxy endpoint is added.
- **Daily cadence, not hourly.** The hourly deterministic refresh continues unchanged; the LLM enrichment pass runs once per day (cost discipline — ~200 repos × one enrichment call × 30 days is a sane bill; hourly is not).
- **Cache-in-repo.** The Action writes each repo's semantic score into `repos.json` alongside the deterministic score. The browser and paste-audit read this cache; they never initiate the call themselves.
- **Paste-audit is honest about being narrower.** Because the browser can't call Claude, a pasted CLAUDE.md is scored by the catalogue only. The UI must label this: "pasted audits use the deterministic catalogue; leaderboard scores also include daily semantic enrichment." Without that label, the paste-audit score is misleading.
- **Scoring field separation.** `repos.json` keeps `score` (deterministic, pasted-audit parity) and adds `semantic_score` + `semantic_refreshed_at` (LLM-enriched, Action-only). The leaderboard may display a blended score, but both raw fields remain inspectable.
- **Honest data still applies.** The LLM layer is for detecting paraphrased redundancy, not for manufacturing higher scores. If semantic enrichment doesn't meaningfully shift the distribution, that's shippable data too.

Why: regex/phrase matching misses paraphrased redundancy ("make sure to read files before editing" vs "always check file contents first"). Semantic understanding catches them. CI-only scoping keeps the privacy/reproducibility contract with users intact while closing the accuracy gap. Session 7 dashboard review named the accuracy gap as the real launch blocker.

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

**What the catalogue-v3 re-crawl + manual check already proved (2026-04-17):**

1. The deterministic catalogue alone is insufficient. At 82 regex patterns the
   distribution collapsed to `[185, 0, 0, 0, 0]`; doubling the catalogue size
   again would not meaningfully change that. Regex cannot see semantic paraphrase.
2. Redundancy is real but rare, and it is invisible without semantic analysis.
   The zenml file is the ground-truth example: five Claude-default duplicates
   across 24k chars, all paraphrased past regex reach.
3. File size does not predict redundancy. The cleanest of the five sampled
   files was the largest (44k chars, `javascript-obfuscator`). The dirtiest was
   middling (24k, `zenml`). Developers have no heuristic available today to
   self-diagnose.

**What v0.1.x still has to prove (Issue #10 onward):**

- That an LLM-enrichment layer can correctly flag the 5 zenml redundancies
  *and* leave the 4 other sampled files untouched (or nearly so). The
  acceptance fixture is `docs/ground-truth-2026-04-17.md`.
- That the leaderboard, once the semantic layer lands, produces a distribution
  whose shape matches the manual check — i.e., a modest fraction of repos
  scoring as semantically redundant, not all 185 suddenly lighting up.
- That the narrative survives either outcome. If semantic enrichment shows
  ~15% of top repos are redundant, the product is *"tell me which 15% I'm
  in."* If it shows ~1%, the product is *"rare but real; here's the audit."*
  Both are shippable per the honest-data rule. What is not shippable is a
  prompt tuned to produce a pre-decided number.
