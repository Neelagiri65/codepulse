// Semantic enrichment for CLAUDE.md files — daily LLM pass that flags
// instructions duplicating Claude Code's documented defaults. Deterministic
// score stays in score.ts; this layer is purely additive.

import { GoogleGenAI, Type } from '@google/genai';

export type SemanticConfidence = 'high' | 'medium' | 'low';

export interface MatchedIntent {
  quote: string;
  reason: string;
  confidence: SemanticConfidence;
}

export interface SemanticResult {
  semantic_score: number;
  matched_intents: MatchedIntent[];
}

export type ModelId = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface EnrichOptions {
  model: ModelId;
  apiKey?: string;
}

const CONFIDENCE_WEIGHT: Record<SemanticConfidence, number> = {
  high: 4,
  medium: 2,
  low: 1,
};

const SYSTEM_PROMPT = `You are grading a CLAUDE.md file used to configure the Claude Code CLI. Answer ONE question for each instruction in the file:

"Is this sentence instructing Claude to do something Claude Code already does by default?"

If YES, flag it as redundant. If NO or unclear, do NOT flag it.

### Claude Code's documented default behaviours (the anchor set)

Claude Code already does all of these without being told. Any CLAUDE.md instruction duplicating one of these is redundant:

**Commenting**
- Does not explain WHAT the code does (well-named identifiers carry that).
- Only writes a comment when the WHY is non-obvious (hidden constraint, workaround, subtle invariant).
- No multi-paragraph docstrings or multi-line comment blocks.

**Git commits**
- Commit messages focus on WHY not WHAT, 1–2 sentences, imperative-mood summary.
- Creates new commits rather than amending.
- Never commits secrets or broken code.

**Debugging / fixing**
- Identifies root causes rather than bypassing safety checks.
- Investigates unfamiliar state before deleting or overwriting.

**Task management**
- Decomposes non-trivial tasks and tracks progress (TaskCreate).
- Marks tasks complete as soon as done; does not batch.
- Plans approach before implementation on non-trivial work; tests incrementally.

**Code style**
- Does not add error handling or validation for scenarios that can't happen.
- Does not add features, refactors, or abstractions beyond what the task requires.
- Prefers editing existing files over creating new ones.
- Does not write docs, README, or summary files unless explicitly asked.

**Communication**
- Short, direct answers; length matches the task.
- No preamble greetings ("Great question!"), no restating the user's words.
- States action briefly before first tool call; short updates at key moments only.
- No trailing end-of-turn summary.
- Does not narrate internal deliberation.
- Does not use emojis unless asked.

**Tool use**
- Prefers dedicated tools (Read/Edit/Write/Glob/Grep) over Bash when applicable.
- Runs independent tool calls in parallel.
- Uses absolute paths for reads; does not poll background tasks.

**Safety**
- Asks before destructive operations (rm -rf, force push, reset --hard, deleting files or branches).
- Does not modify files outside the project directory without explicit instruction.
- Does not upload sensitive content to third-party services.

### What does NOT count as redundant — do NOT flag these

- **Project-specific content**: build/test commands, architecture, file paths, API contracts, domain rules, team conventions that are genuinely specific to this project.
- **Overrides (contradicting a default)**: e.g. "Add appropriate error handling" is the OPPOSITE of Claude's default (which is to avoid over-validating). Legitimate override. Do NOT flag.
- **Stricter hardening**: e.g. "never force push" is stricter than Claude's default (which is to ask). Hardening, not redundancy. Do NOT flag.
- **Project commit cadence**: "commit after every test passes" is project guidance unless it verbatim restates the default.

### Precision over recall

A single false positive on a file full of legitimate project content damages product credibility more than several missed redundancies. When uncertain, do NOT flag.

### Confidence calibration — READ CAREFULLY

Confidence reflects how thoroughly the instruction duplicates a default, NOT just the strength of semantic overlap:

- \`high\` — an explicit multi-clause instruction, full sentence, or numbered section that thoroughly duplicates a default. The redundancy would be obvious to a casual reader. Examples: a 3-bullet "Commit Message Guidelines" block that restates why-not-what + 50-char summary + imperative mood; a paragraph explaining the commenting policy at length.
- \`medium\` — a single clear sentence that restates a default without much elaboration.
- \`low\` — a short phrase (roughly ≤12 words) or single clause that overlaps with a default but stands alone, could plausibly read as a reminder to humans, or is a passing mention inside a larger project-specific section. Terse bullet points almost always belong here.

**A short standalone phrase (e.g. "Comments for non-obvious logic only") must be \`low\` regardless of how closely it paraphrases the default.** Reserve \`high\` for thorough, explicit, multi-clause duplication.

Copy the offending sentence(s) verbatim in \`quote\`. In \`reason\`, name the specific Claude default being duplicated (e.g. "Claude Code already writes why-not-what comments by default"). Return an empty array if nothing in the file is redundant.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    matched_intents: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          quote: { type: Type.STRING },
          reason: { type: Type.STRING },
          confidence: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
        },
        required: ['quote', 'reason', 'confidence'],
      },
    },
  },
  required: ['matched_intents'],
};

function scoreFromIntents(intents: MatchedIntent[]): number {
  return intents.reduce((acc, m) => acc + (CONFIDENCE_WEIGHT[m.confidence] ?? 0), 0);
}

export async function enrichSemanticScore(
  content: string,
  opts: EnrichOptions,
): Promise<SemanticResult> {
  const apiKey = opts.apiKey ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('enrichSemanticScore: GEMINI_API_KEY not set');

  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: opts.model,
    contents: content,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  });

  const text = res.text;
  if (!text) throw new Error('enrichSemanticScore: empty response from Gemini');

  let parsed: { matched_intents?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`enrichSemanticScore: non-JSON response: ${String(err)}`);
  }

  const raw = Array.isArray(parsed.matched_intents) ? parsed.matched_intents : [];
  const matched_intents: MatchedIntent[] = raw
    .filter((m): m is MatchedIntent =>
      Boolean(
        m &&
          typeof (m as MatchedIntent).quote === 'string' &&
          typeof (m as MatchedIntent).reason === 'string' &&
          ['high', 'medium', 'low'].includes((m as MatchedIntent).confidence),
      ),
    )
    .map((m) => ({ quote: m.quote, reason: m.reason, confidence: m.confidence }));

  return { semantic_score: scoreFromIntents(matched_intents), matched_intents };
}
