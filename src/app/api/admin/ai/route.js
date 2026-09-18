import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSystemAdmin } from '@/lib/session'
import { AI_MODEL, PRICING, PRICING_AS_OF, costOf, apiKeyStatus } from '@/lib/aiConfig'

// The one thing the owner does not get to see. Guarded by role on the server,
// so hiding the nav link is a convenience and not the control.
export async function GET() {
  const { unauthorized } = await requireSystemAdmin()
  if (unauthorized) return unauthorized

  try {
    const rows = await withClient(async (client) => {
      const result = await client.query(`
        SELECT feature,
               model,
               COUNT(*)::int                             AS calls,
               COUNT(*) FILTER (WHERE NOT ok)::int       AS failures,
               SUM(input_tokens)::bigint                 AS input_tokens,
               SUM(output_tokens)::bigint                AS output_tokens,
               SUM(cache_creation_input_tokens)::bigint  AS cache_creation_input_tokens,
               SUM(cache_read_input_tokens)::bigint      AS cache_read_input_tokens,
               MAX(created_at)                           AS last_used
        FROM ai_usage
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY feature, model
        ORDER BY SUM(input_tokens + output_tokens) DESC
      `)
      return result.rows
    })

    // Cost is computed here, from today's rates, rather than stored per row —
    // so a price change re-prices history instead of leaving it half-stale.
    const usage = rows.map((r) => ({
      ...r,
      input_tokens: Number(r.input_tokens),
      output_tokens: Number(r.output_tokens),
      cache_creation_input_tokens: Number(r.cache_creation_input_tokens),
      cache_read_input_tokens: Number(r.cache_read_input_tokens),
      cost: costOf({
        model: r.model,
        input_tokens: Number(r.input_tokens),
        output_tokens: Number(r.output_tokens),
        cache_creation_input_tokens: Number(r.cache_creation_input_tokens),
        cache_read_input_tokens: Number(r.cache_read_input_tokens),
      }),
    }))

    const total = usage.reduce((sum, u) => sum + (u.cost || 0), 0)

    return NextResponse.json({
      model: AI_MODEL,
      pricing: PRICING[AI_MODEL] || null,
      pricing_as_of: PRICING_AS_OF,
      api_key: apiKeyStatus(),
      usage,
      total_cost: total,
      window_days: 30,
    })
  } catch (error) {
    console.error('Failed to load AI usage:', error)
    return NextResponse.json({ error: 'Failed to load AI usage' }, { status: 500 })
  }
}
