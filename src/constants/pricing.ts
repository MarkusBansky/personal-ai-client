/**
 * Hardcoded model pricing data ($ per million tokens).
 * Sources (as of March 2026):
 *   - OpenAI:    https://openai.com/api/pricing/
 *   - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 *   - Mistral:   https://mistral.ai/pricing#api
 *
 * To update, simply edit the entries below.
 */

export interface ModelPricing {
  /** Cost in USD per 1 million input tokens */
  input: number;
  /** Cost in USD per 1 million output tokens */
  output: number;
}

// Keys are lowercase prefixes/patterns matched against model IDs.
// More specific keys should appear before more general ones.
const MODEL_PRICING: Record<string, ModelPricing> = {
  // ── OpenAI ────────────────────────────────────────────────────────────────
  'gpt-5.4':           { input: 2.50,  output: 15.00 },
  'gpt-5-mini':        { input: 0.25,  output: 2.00 },
  'gpt-4.1-nano':      { input: 0.10,  output: 0.40 },
  'gpt-4.1-mini':      { input: 0.40,  output: 1.60 },
  'gpt-4.1':           { input: 2.00,  output: 8.00 },
  'gpt-4o-mini':       { input: 0.15,  output: 0.60 },
  'gpt-4o':            { input: 2.50,  output: 10.00 },
  'gpt-4-turbo':       { input: 10.00, output: 30.00 },
  'gpt-4':             { input: 30.00, output: 60.00 },
  'gpt-3.5-turbo':     { input: 0.50,  output: 1.50 },
  'o4-mini':           { input: 1.10,  output: 4.40 },
  'o3-mini':           { input: 1.10,  output: 4.40 },
  'o3':                { input: 2.00,  output: 8.00 },
  'o1-mini':           { input: 1.10,  output: 4.40 },
  'o1':                { input: 15.00, output: 60.00 },

  // ── Anthropic ─────────────────────────────────────────────────────────────
  'claude-opus-4.6':   { input: 5.00,  output: 25.00 },
  'claude-opus-4.5':   { input: 5.00,  output: 25.00 },
  'claude-opus-4.1':   { input: 15.00, output: 75.00 },
  'claude-opus-4':     { input: 15.00, output: 75.00 },
  'claude-sonnet-4.6': { input: 3.00,  output: 15.00 },
  'claude-sonnet-4.5': { input: 3.00,  output: 15.00 },
  'claude-sonnet-4':   { input: 3.00,  output: 15.00 },
  'claude-sonnet-3.7': { input: 3.00,  output: 15.00 },
  'claude-haiku-4.5':  { input: 1.00,  output: 5.00 },
  'claude-haiku-3.5':  { input: 0.80,  output: 4.00 },
  'claude-opus-3':     { input: 15.00, output: 75.00 },
  'claude-haiku-3':    { input: 0.25,  output: 1.25 },
  'claude-3-5-sonnet': { input: 3.00,  output: 15.00 },
  'claude-3-5-haiku':  { input: 0.80,  output: 4.00 },
  'claude-3-opus':     { input: 15.00, output: 75.00 },
  'claude-3-sonnet':   { input: 3.00,  output: 15.00 },
  'claude-3-haiku':    { input: 0.25,  output: 1.25 },

  // ── Mistral ───────────────────────────────────────────────────────────────
  'mistral-large':           { input: 0.50,  output: 1.50 },
  'mistral-medium':          { input: 0.40,  output: 2.00 },
  'mistral-small':           { input: 0.10,  output: 0.30 },
  'devstral-medium':         { input: 0.40,  output: 2.00 },
  'devstral-small':          { input: 0.10,  output: 0.30 },
  'codestral':               { input: 0.30,  output: 0.90 },
  'magistral-medium':        { input: 2.00,  output: 5.00 },
  'magistral-small':         { input: 0.50,  output: 1.50 },
  'ministral-3b':            { input: 0.10,  output: 0.10 },
  'ministral-8b':            { input: 0.15,  output: 0.15 },
  'ministral-14b':           { input: 0.20,  output: 0.20 },
  'pixtral-large':           { input: 2.00,  output: 6.00 },
  'pixtral-12b':             { input: 0.15,  output: 0.15 },
  'open-mistral-nemo':       { input: 0.15,  output: 0.15 },
  'open-mistral-7b':         { input: 0.25,  output: 0.25 },
  'open-mixtral-8x22b':      { input: 2.00,  output: 6.00 },
  'open-mixtral-8x7b':       { input: 0.70,  output: 0.70 },
  'labs-mistral-small-creative': { input: 0.10, output: 0.30 },
};

// Sorted keys: longest first so more specific prefixes match before short ones.
const sortedKeys = Object.keys(MODEL_PRICING).sort((a, b) => b.length - a.length);

/**
 * Look up pricing for a model ID. Performs case-insensitive prefix matching
 * so that versioned IDs like "claude-sonnet-4-20250514" resolve correctly.
 */
export function getModelPricing(modelId: string): ModelPricing | null {
  const lower = modelId.toLowerCase();
  for (const key of sortedKeys) {
    if (lower.startsWith(key) || lower.includes(key)) {
      return MODEL_PRICING[key];
    }
  }
  return null;
}

/** Format a $/MTok value for display, e.g. "$0.50" */
export function formatPrice(pricePerMTok: number): string {
  if (pricePerMTok >= 1) return `$${pricePerMTok.toFixed(pricePerMTok % 1 === 0 ? 0 : 2)}`;
  return `$${pricePerMTok.toFixed(2)}`;
}

/** Calculate message cost from token counts and $/MTok rates. Returns null when pricing is unavailable. */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  pricing: ModelPricing | null,
): number | null {
  if (!pricing) return null;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/** Format a dollar cost for display: "$0.0012" or "< $0.0001" */
export function formatCost(cost: number): string {
  if (cost < 0.0001) return '< $0.0001';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}
