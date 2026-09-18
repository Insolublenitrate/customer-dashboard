import { withClient } from './db.js'

// Recording a call must never be the reason a call fails: the feature already
// worked by the time we get here, so a ledger write that throws is logged and
// swallowed rather than surfaced.
export async function recordUsage({ feature, model, usage, ok = true, error = null }) {
  try {
    await withClient((client) =>
      client.query(
        `INSERT INTO ai_usage (feature, model, input_tokens, output_tokens,
                               cache_creation_input_tokens, cache_read_input_tokens, ok, error)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          feature,
          model || 'unknown',
          usage?.input_tokens ?? 0,
          usage?.output_tokens ?? 0,
          usage?.cache_creation_input_tokens ?? 0,
          usage?.cache_read_input_tokens ?? 0,
          ok,
          error,
        ]
      )
    )
  } catch (err) {
    console.error('Could not record AI usage (the call itself succeeded):', err)
  }
}
