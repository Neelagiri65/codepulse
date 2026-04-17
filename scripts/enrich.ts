// Semantic enrichment for CLAUDE.md files — daily LLM pass that flags
// instructions duplicating Claude Code's documented defaults. Deterministic
// score stays in score.ts; this layer is purely additive.

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

export type ModelId = 'claude-haiku-4-5-20251001' | 'claude-sonnet-4-6';

export interface EnrichOptions {
  model: ModelId;
  apiKey?: string;
}

export async function enrichSemanticScore(
  _content: string,
  _opts: EnrichOptions,
): Promise<SemanticResult> {
  throw new Error('enrichSemanticScore: not implemented');
}
