// One place for the model and what it costs, so the system admin's System panel
// and the calls themselves cannot drift apart.

export const AI_MODEL = 'claude-opus-5'

// Rates are per million tokens, from Anthropic's published pricing for
// claude-opus-5 (read 2026-09-18). Cache multipliers are the documented ones:
// a cache write costs ~1.25x the input rate, a cache read ~0.1x.
//
// These are a snapshot. The System panel shows the date so nobody reads a
// figure here as today's bill; re-check the pricing page before relying on it
// for anything that matters.
export const PRICING = {
  'claude-opus-5': { inputPerMTok: 5.0, outputPerMTok: 25.0 },
}

export const PRICING_AS_OF = '2026-09-18'

const CACHE_WRITE_MULTIPLIER = 1.25
const CACHE_READ_MULTIPLIER = 0.1

// Returns null for a model with no rate on file rather than inventing one — a
// wrong number here is worse than an honest blank.
export function costOf({ model, input_tokens = 0, output_tokens = 0,
                         cache_creation_input_tokens = 0, cache_read_input_tokens = 0 }) {
  const rate = PRICING[model]
  if (!rate) return null
  const perToken = rate.inputPerMTok / 1_000_000
  return (
    Number(input_tokens) * perToken +
    Number(cache_creation_input_tokens) * perToken * CACHE_WRITE_MULTIPLIER +
    Number(cache_read_input_tokens) * perToken * CACHE_READ_MULTIPLIER +
    Number(output_tokens) * (rate.outputPerMTok / 1_000_000)
  )
}

// The key lives only on the server. The System panel reports whether one is
// configured and how it ends, never the key.
export function apiKeyStatus() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { configured: false, hint: null }
  return { configured: true, hint: `…${key.slice(-4)}` }
}
