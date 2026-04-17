# Ground-truth manual check — 2026-04-17

Purpose: pin the single most important empirical finding in CodePulse's product arc.
After catalogue v3 (82 regex patterns) produced distribution `[185, 0, 0, 0, 0]` with
max score 7, a manual read of 5 zero-scoring large `CLAUDE.md` files established
whether the thesis ("redundancy exists but regex can't catch it") is real or not.

The 5 files below are the acceptance fixture for Issue #10 (LLM enrichment). Any
semantic-scoring implementation must:

- Flag the 5 specific redundancies listed under **zenml-io/zenml**.
- Not flag anything in the other 4 files as redundant.

If it fails either side, ship the failure honestly — don't tune the prompt to
manufacture the desired outcome.

## Method

Picked 5 repos from `data/repos.json` with `score == 0` and `char_count ≥ 10000`.
Fetched raw `CLAUDE.md` at HEAD from each. Read line-by-line. Classified every
candidate sentence against one question:

> **Is this sentence instructing Claude to do something Claude Code already does by default?**

This is the exact line the LLM prompt must implement. Not "does it sound like
general advice." Not "is it verbose." The specific test is: does Claude Code
behave this way *without* being told. If yes, it's redundancy.

## Files and verdicts

### 1. zenml-io/zenml — 24k chars — **HEAVY redundancy (false negative)**

Fetched from `https://raw.githubusercontent.com/zenml-io/zenml/main/CLAUDE.md`.

**Must-flag redundancies (the 5 the LLM has to catch):**

1. **Commenting policy — "explain why, not what"** (lines 29–34 of fetched file).
   Duplicates Claude Code default: *"Only add [a comment] when the WHY is
   non-obvious… Don't explain WHAT the code does."* The zenml file spends ~6 lines
   restating this in paraphrased prose.

2. **Commit messages "why not what"** (line 284):
   *"Write clear, descriptive commit messages explaining the 'why' not just the
   'what'."* Duplicates Claude Code git-commit default:
   *"Draft a concise (1-2 sentences) commit message that focuses on the 'why'
   rather than the 'what'."*

3. **Commit formatting conventions** (lines 285–286):
   *"First line should be a concise summary (50 chars or less)… Use imperative
   mood: 'Add feature' not 'Added feature'."* These are standard git conventions
   Claude Code already follows when composing commit messages.

4. **Root-cause-before-fix** (lines 358–361, "When Fixing Bugs"):
   *"Understand root cause before implementing fix"* + *"Add regression tests
   that would have caught the bug."* Duplicates Claude Code default:
   *"try to identify root causes and fix underlying issues rather than bypassing
   safety checks."*

5. **Task planning approach** (lines 431–438):
   *"Break down the task into smaller sub-tasks… Plan approach before
   implementation… Test incrementally."* Duplicates Claude Code's default
   TaskCreate / planning behaviour — Claude already decomposes non-trivial tasks
   and tests incrementally without being told.

**Note on phrasing:** all 5 are paraphrased semantic duplicates. None of them
share enough surface structure with the Claude-default phrasing for a regex to
catch. This is the exact case the LLM layer exists to solve.

**Also present but borderline — do NOT flag unless LLM is confident:**

- Line 267 "NEVER commit secrets" — Claude Code already refuses, but the ZenML
  phrasing reads as a reminder to the human, not an instruction to Claude.
  Ambiguous. Leave to LLM judgement.
- Line 304 "Add appropriate error handling" — this is *inverse* to Claude
  default (*"Don't add error handling… for scenarios that can't happen"*). It's
  project-specific override, not redundancy. Do NOT flag.

### 2. nearai/ironclaw — 17k chars — **clean (minimal redundancy)**

Fetched from `https://raw.githubusercontent.com/nearai/ironclaw/main/CLAUDE.md`.

Almost entirely legitimate project-specific content: Rust build commands,
module architecture, crate boundaries, job state machine, tool dispatcher rules.

One borderline line (26): *"Comments for non-obvious logic only"* — this does
paraphrase a Claude default. Acceptable for LLM to flag as a weak hit (low
confidence/weight). Do **not** flag at high confidence — the rest of the file
contains zero redundancy.

**Expected Issue #10 outcome:** zero or one low-confidence hit.

### 3. SuperCmdLabs/SuperCmd — 28k chars — **clean**

Fetched from `https://raw.githubusercontent.com/SuperCmdLabs/SuperCmd/main/CLAUDE.md`.

~350 of the 490 lines are Raycast API status tables and a per-file map of the
compatibility runtime. The rest is project structure, extension execution model,
integration notes. Zero Claude-default redundancy.

**Expected Issue #10 outcome:** zero hits. Any flag here is a false positive
and should fail the acceptance test.

### 4. javascript-obfuscator/javascript-obfuscator — 44k chars — **clean**

Fetched from `https://raw.githubusercontent.com/javascript-obfuscator/javascript-obfuscator/master/CLAUDE.md`.

Project documentation: obfuscation technique catalogue, architecture, design
patterns (Visitor, Factory, Storage), CLI command reference, exhaustive test
command reference. Zero Claude-default redundancy.

**Expected Issue #10 outcome:** zero hits. Any flag here is a false positive.

### 5. jayminwest/overstory — 37k chars — **mostly clean, mild**

Fetched from `https://raw.githubusercontent.com/jayminwest/overstory/main/CLAUDE.md`.

Swarm/orchestration tool documentation. Legitimate project content: CLI
command catalogue, directory structure, runtime adapters, tracker integration.
One section ("Quality Gates", lines 633–641) instructs running tests+lint+
typecheck before committing — this is a mild paraphrase of Claude's default
*"NEVER commit broken code. Run build/test before every commit."* But the
overstory version names the specific tools (`bun test`, `biome check`, `tsc
--noEmit`), which adds project value.

**Expected Issue #10 outcome:** zero or one low-confidence hit on the Quality
Gates section. Not a hard requirement either way.

## Fetch commands (reproducibility)

```bash
mkdir -p /tmp/codepulse-manual-check && cd /tmp/codepulse-manual-check
curl -fsSL https://raw.githubusercontent.com/zenml-io/zenml/main/CLAUDE.md -o zenml.md
curl -fsSL https://raw.githubusercontent.com/nearai/ironclaw/main/CLAUDE.md -o ironclaw.md
curl -fsSL https://raw.githubusercontent.com/SuperCmdLabs/SuperCmd/main/CLAUDE.md -o supercmd.md
curl -fsSL https://raw.githubusercontent.com/javascript-obfuscator/javascript-obfuscator/master/CLAUDE.md -o jsobf.md
curl -fsSL https://raw.githubusercontent.com/jayminwest/overstory/main/CLAUDE.md -o overstory.md
```

Files at the repo HEAD can drift. A re-fetch weeks later may produce different
line numbers for the zenml redundancies. The *semantic* findings should remain
stable; re-anchor to the quoted sentences if line numbers no longer match.

## The revised thesis this check locked in

- **Old thesis:** *"Most CLAUDE.md files are bloated with redundancy."*
  Disproved by catalogue v3 distribution `[185, 0, 0, 0, 0]` — max score 7
  across 185 repos even after doubling the regex catalogue.

- **New thesis:** *"Some CLAUDE.md files contain invisible semantic redundancy
  that regex cannot detect. Large file size does not predict which category a
  file is in. The product value is telling developers which bucket their own
  file is in."*

This shifts the launch narrative from *"cargo cult confirmed"* to *"most of the
ecosystem is cleaner than you'd expect; here's how to tell if yours is one of
the ones that isn't."* Either is shippable per the PRD honest-data rule; the
second is the truer story and the one the v1 must tell.

## What this doc is NOT

Not the LLM prompt itself. Issue #10 writes the prompt and the acceptance
harness. This doc is the *ground truth* Issue #10 is graded against.
