# HANDOFF — CodePulse

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

### What's done this session (live)
- [x] PR #2 squash-merged into `main`, remote branch deleted.
- [x] `feature/catalogue` branched off clean `main`.
- [x] HANDOFF.md updated as first commit.
- [ ] Research the three source classes.
- [ ] Failing tests for `scripts/validate-catalogue.ts` (red).
- [ ] Validator implemented (green).
- [ ] Catalogue drafted with sourced entries.
- [ ] `docs/catalogue-authoring.md` written.
- [ ] PR #3 opened.

### NEXT action (for the next session)
Review the draft `data/catalogue.json` entry-by-entry in PR #3. For each: does the source_url load? does it support the redundancy claim? reject any that feel like a stretch. Add entries from your own repo/forum experience where the catalogue is thin. Merge PR #3 only when every surviving entry is defensible.

After #3 merges: Issue #4 (GitHub Actions cron refresh pipeline). That needs `GH_TOKEN` as a repo secret — set that up manually before session 5 starts.

### Open questions / decisions deferred
- Can Piebald's system prompt components be sourced publicly, or only via their CLI? (Research step will answer.)
- Does `scorecard.skipped` surface in the UI (Issue #5/#6)? — still open.
- Domain (Issue #7) — still deferred.

### Git state
- Branch: `feature/catalogue` off `main` (`4fa8156`).
- Remote: https://github.com/Neelagiri65/codepulse
- PR #1 and PR #2 merged as of this session.

### File operations this session
(updated at session end)
