# Catalogue authoring rules

The redundancy catalogue at `data/catalogue.json` is the credibility layer of CodePulse. Every entry in it becomes part of the leaderboard score for 200 public repos and of every paste-audit scorecard. A single stretch entry undermines the whole thesis.

These rules exist so the catalogue stays defensible even as we add entries quickly.

## The bar

**An entry is admissible only if you can point to a URL that supports the claim today.** "Seems redundant" is not admissible. "I've seen this pattern a lot" is not admissible.

A claim looks like this:

> *Claude Code already does X (per [URL]). Therefore writing "do X" in a CLAUDE.md adds no behaviour and wastes context.*

If you cannot fill in both halves of that sentence, the entry does not belong in the catalogue.

## Admissible sources

Three, no others:

1. **Anthropic's official Claude Code documentation.**
   - Canonical URL: `https://code.claude.com/docs/en/best-practices` and sibling pages.
   - This is the highest-authority source. Doc text is *stable* in the sense that Anthropic owns it and corrects it. Cite the specific doc page, not a summary.

2. **The Piebald mirror of Claude Code's system prompt.**
   - Canonical URL: `https://github.com/Piebald-AI/claude-code-system-prompts`
   - Piebald extracts and version-tracks Claude Code's built-in system prompt. If the system prompt already says "be concise," a user's CLAUDE.md saying "be concise" is redundant by definition.
   - Cite the specific file, e.g. `system-prompts/system-prompt-communication-style.md`, not the repo root.
   - Piebald updates within days of each Claude Code release; drift is possible. If a citation is more than 30 days old, re-verify.

3. **An observed-in-repo citation with the explicit repo URL.**
   - Only admissible when (a) the pattern appears in the wild in a specific public repo's `CLAUDE.md`, and (b) the pattern contradicts a *documented* Claude Code default — the citation is then really a citation of the default, but with a repo example for illustration.
   - The `source_url` in the entry must still be the doc/Piebald URL that *supports* the redundancy claim. The repo URL can go in `reason`, not `source_url`.

## What does not belong in the catalogue

- **"This is bad style"** entries. We are not grading style. We are identifying redundancy against documented defaults.
- **Opinions from blog posts or tweets.** Even well-reasoned ones. If the behaviour is not in the Anthropic docs or the Piebald system-prompt mirror, do not base a catalogue entry on it.
- **Project-specific conventions.** "Most Next.js CLAUDE.md files say X" is not redundancy. It is convention. Leave it out.
- **Vague aspirational lines.** "Write good code." "Be helpful." "Think carefully." These are too broad to be redundant of any specific instruction and will over-match.
- **Things Claude Code *used to* do.** Piebald version-tracks the prompt; if a behaviour was removed from the system prompt in v2.1.x, the redundancy claim no longer holds.

## Schema (enforced by `pnpm validate:catalogue`)

```json
{
  "id": "kebab-case-unique-identifier",
  "match_type": "phrase" | "regex",
  "match_value": "literal string | regex source (no slashes, no flags)",
  "weight": 1-10,
  "source_url": "https://…",
  "reason": "One or two sentences. Include the quoted phrase from the source where possible.",
  "added_at": "YYYY-MM-DD"
}
```

### Weight guidance

| Weight | When to use |
|---|---|
| 1–2 | Very mild — a nudge, not a redundancy. Rarely used. |
| 3 | Self-evident best-practice guidance from Anthropic's docs (e.g. "write clean code"). |
| 4–5 | Redundant of a specific recommendation in the docs or system prompt. |
| 6–8 | Directly restates wording that is already in Claude Code's system prompt. |
| 9–10 | Reserved. Multi-paragraph restatements of entire system-prompt sections. Use sparingly. |

### Match-type guidance

- **`phrase`** for distinctive, unambiguous wording that always appears the same way (e.g. `file_path:line_number`). Phrase matches are case-sensitive — `new RegExp` is not involved.
- **`regex`** for patterns that vary in casing, wording, or punctuation. Remember: `score()` uses bare `new RegExp(value)` with no flags. Use `[Xx]` character classes for sentence-start variation; do not rely on `i` or `g` flags.
- Prefer phrase over regex where possible. Regex bugs inflate false positives, which inflates scores dishonestly.

### Regex safety checklist

- Compile the regex mentally — does `[unterminated` make it in? The validator will catch it.
- Does the pattern match benign English that happens to contain the words? E.g. `regex: "\\bconcise\\b"` matches *"the report was not concise"*. Add enough context so the pattern only fires on instruction-like wording: `"[Bb]e concise"`.
- Does the pattern over-match across unrelated bullets? Walk through a sample CLAUDE.md before committing.

## Adding an entry — workflow

1. Find the wording in a real CLAUDE.md or imagine it from experience.
2. Find a doc or Piebald URL that says Claude Code already does this.
3. If you cannot find that URL in under five minutes: **stop**. The entry is not admissible.
4. Write the entry with an honest `reason` that quotes the source.
5. Run `pnpm validate:catalogue`.
6. Run a smoke test: paste a CLAUDE.md snippet containing and not containing the pattern, check the scorecard.
7. Commit.

## Reviewing someone else's entry

For every entry:

- [ ] Does the `source_url` load?
- [ ] Does the linked text actually support the claim?
- [ ] Is the `match_value` specific enough that it will not over-match benign prose?
- [ ] Is the `weight` proportional to how clearly the behaviour is already in the system prompt?
- [ ] Would a developer reading this entry agree that they have been wasting tokens?

If any answer is no, reject the entry. The catalogue is the product.

## When the system prompt changes

Piebald pushes updates within days of each Claude Code release. Any catalogue entry whose claim depends on a specific line in the system prompt must be re-verified when the Piebald changelog indicates a relevant change.

The hourly refresh pipeline (Issue #4) does not re-verify citations. Verification is a human review task. A quarterly catalogue review is the minimum cadence; more often if Claude Code ships a major system-prompt rewrite.

## Honest data over big numbers

If manual review reduces the catalogue from 50 entries to 30 because 20 were stretches, the catalogue is *better*, not worse. The leaderboard score is lower-but-defensible, and the project's launch narrative adjusts accordingly. Never pad the catalogue to manufacture a larger score.

This is the architectural constraint test from the PRD: *if the data disproves the thesis, ship the data honestly and adjust the narrative.*
