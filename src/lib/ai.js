import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { betaZodTool } from '@anthropic-ai/sdk/helpers/beta/zod'

const client = new Anthropic()

const ExtractionSchema = z.object({
  summary: z.string().describe('2-4 sentence summary of what this communication says or decides'),
  facility_guess: z
    .string()
    .nullable()
    .describe('Best-guess name of the facility this relates to, matched against the known facility list. Null if unclear.'),
  action_items: z
    .array(
      z.object({
        description: z.string(),
        owner: z.string().nullable().describe('Who is responsible, if stated'),
        due_date: z.string().nullable().describe('ISO date YYYY-MM-DD if a deadline is mentioned, else null'),
      })
    )
    .describe('Concrete follow-up actions mentioned in the text. Empty array if none.'),
})

const SYSTEM_PROMPT = `You are reviewing internal communications for a supplier of custom, large-volume ultrasonic cleaning machines. Their customer is a single large company with multiple facilities; one "mother" facility sets most specs, and other facilities have their own regional needs and regulatory requirements. You read meeting minutes, emails, and call notes and extract what a busy account manager needs: a short summary, which facility it's about, and any concrete action items.`

// text and/or pdfBase64 - at least one must be provided.
export async function analyzeCommunication({ text, pdfBase64, facilityNames }) {
  const content = []

  if (pdfBase64) {
    content.push({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
    })
  }

  const facilityList = facilityNames.length ? facilityNames.join(', ') : '(no facilities on file yet)'
  content.push({
    type: 'text',
    text: `Known facilities for this account: ${facilityList}\n\nSummarize the communication below and extract any action items.${
      text ? `\n\n---\n${text}\n---` : ''
    }`,
  })

  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }],
    output_config: { format: zodOutputFormat(ExtractionSchema) },
  })

  return response.parsed_output
}

export const FINDING_CATEGORIES = [
  'sales_opportunity',
  'operational_risk',
  'relationship',
  'commercial',
  'data_gap',
]

const BriefingSchema = z.object({
  headline: z
    .string()
    .describe('2-3 sentences on the state of the account right now. Lead with what changed or what matters most, not a restatement of the totals.'),
  findings: z
    .array(
      z.object({
        title: z.string().describe('A specific, concrete claim. Not a topic label.'),
        category: z.enum(FINDING_CATEGORIES),
        priority: z.enum(['high', 'medium', 'low']),
        detail: z.string().describe('What is happening and why it matters commercially, in 2-4 sentences.'),
        evidence: z
          .string()
          .describe('The specific numbers from the data this rests on. A reader must be able to check it against the dashboard.'),
        recommended_action: z.string().describe('One concrete next step, specific enough to act on this week.'),
        facility_id: z
          .number()
          .nullable()
          .describe('The facility_id this concerns, taken from the data. Null if it is account-wide.'),
      })
    )
    .describe('Between 4 and 8 findings, ordered most important first.'),
})

const ADVISOR_SYSTEM_PROMPT = `You are the business analyst for a small supplier of custom, large-volume ultrasonic cleaning machines. The owner sells machines and the detergent that runs in them to a single large industrial customer with multiple facilities. One "mother" facility sets most specs; other sites have regional and regulatory differences.

You are given a structured snapshot of the whole account. Your job is to tell the owner what he would not notice himself, across sales, operations, sourcing, and the customer relationship.

How to be useful here:

- Ground every finding in specific numbers from the snapshot. State them in the evidence field. A finding that cannot cite data does not belong in the output.
- Prefer the non-obvious. "You have 3 overdue action items" is already on his dashboard. "Phoenix has run 9 months without a consumable order while its two machines should be drawing ~60 gal/month" is the kind of thing he is paying you for.
- Look for sales and commercialization angles: sites with machines but no consumable orders, facilities whose fleet has grown without a matching detergent contract, single-machine sites next to multi-machine sites, quotes that have gone quiet, regions where a proven install could be replicated.
- Watch the relationship, not just the transactions: facilities that have gone quiet, sites where every contact is reactive, the mother location's influence on sites that have not been visited.
- Distinguish a real problem from missing data. If usage has never been logged at a site, the honest finding is that the forecast there is running on the planned fill schedule and nobody has confirmed actual consumption — categorize that as a data_gap, not an operational_risk.
- Do not invent facts, facility names, products, or history that is not in the snapshot. If the data is too thin to support a real finding, say so in fewer findings rather than padding with generic advice.
- Write plainly, as if to a busy owner who knows his business well. No consultant vocabulary, no hedging stacks, no restating the question.`

// Produces the written advisory layer over the account snapshot. Findings are
// validated against real facility ids by the caller, since a hallucinated id
// would render as a dead link.
export async function generateBriefing(snapshot) {
  const response = await client.messages.parse({
    model: 'claude-opus-5',
    max_tokens: 8000,
    system: ADVISOR_SYSTEM_PROMPT,
    thinking: { type: 'adaptive' },
    messages: [
      {
        role: 'user',
        content: `Here is the current snapshot of the account. Analyze it and report what matters.\n\n${JSON.stringify(snapshot, null, 2)}`,
      },
    ],
    output_config: { format: zodOutputFormat(BriefingSchema) },
  })

  return { parsed: response.parsed_output, model: response.model }
}

const ASSISTANT_SYSTEM_PROMPT = `You answer questions about a single customer account for a supplier of custom, large-volume ultrasonic cleaning machines. The owner sells machines and the detergent that runs in them to one large industrial customer with multiple facilities.

You are given a snapshot of the account. It covers each facility's machines, consumable stock and forecasts, pipeline, inbound shipments, action item counts and contact history. For anything the snapshot does not cover — the wording of specific action items, what a meeting actually said, individual orders, consumption history over time — use the tools.

How to answer:

- Answer the question that was asked, in as few words as it takes. This is a busy owner on a phone, not a report.
- Cite the actual numbers and names behind your answer so he can check it.
- If the data does not answer the question, say so plainly and say what is missing. Never fill a gap with a plausible guess.
- Distinguish "the data says no" from "nobody has recorded this". A site with no logged usage is not a site with no usage.
- Use the tools when the answer needs detail rather than guessing from the snapshot's aggregates.`

// Read-only lookups for detail the snapshot summarizes away. Every query is
// parameterized against a fixed shape — the model chooses filters, never SQL.
function buildTools(dbClient) {
  return [
    betaZodTool({
      name: 'list_action_items',
      description: 'Action items with their full descriptions, owners and due dates. Use when asked what is outstanding, overdue, or who owns something.',
      inputSchema: z.object({
        facility_id: z.number().nullable().describe('Limit to one facility, or null for all'),
        status: z.enum(['open', 'done', 'any']).describe('Filter by status'),
      }),
      run: async ({ facility_id, status }) => {
        const result = await dbClient.query(
          `SELECT a.id, a.description, a.owner, a.due_date, a.status, f.name AS facility
           FROM action_items a LEFT JOIN facilities f ON f.id = a.facility_id
           WHERE ($1::int IS NULL OR a.facility_id = $1)
             AND ($2 = 'any' OR a.status = $2)
           ORDER BY a.due_date NULLS LAST LIMIT 100`,
          [facility_id, status]
        )
        return JSON.stringify(result.rows)
      },
    }),

    betaZodTool({
      name: 'list_communications',
      description: 'Meeting minutes, emails and call notes with their AI summaries. Use when asked what was discussed or agreed.',
      inputSchema: z.object({
        facility_id: z.number().nullable().describe('Limit to one facility, or null for all'),
        limit: z.number().describe('How many of the most recent to return, up to 25'),
      }),
      run: async ({ facility_id, limit }) => {
        const result = await dbClient.query(
          `SELECT c.id, c.type, c.occurred_at, c.created_at, c.ai_summary, f.name AS facility
           FROM communications c LEFT JOIN facilities f ON f.id = c.facility_id
           WHERE ($1::int IS NULL OR c.facility_id = $1)
           ORDER BY COALESCE(c.occurred_at, c.created_at) DESC LIMIT $2`,
          [facility_id, Math.min(Math.max(Number(limit) || 10, 1), 25)]
        )
        return JSON.stringify(result.rows)
      },
    }),

    betaZodTool({
      name: 'list_orders',
      description: 'Consumable and parts purchase orders, both directions, with line items. Use for questions about what was ordered, shipped or invoiced.',
      inputSchema: z.object({
        facility_id: z.number().nullable(),
        direction: z.enum(['incoming', 'outgoing', 'any']).describe('incoming = sold to the customer, outgoing = bought from a supplier'),
        status: z.string().nullable().describe('Exact PO status, or null for all'),
      }),
      run: async ({ facility_id, direction, status }) => {
        const result = await dbClient.query(
          `SELECT po.id, po.direction, po.status, po.po_number, po.total_value, po.expected_date,
                  po.supplier_name, po.updated_at, f.name AS facility,
                  COALESCE(json_agg(json_build_object('description', i.description, 'quantity', i.quantity,
                    'unit_price', i.unit_price, 'product', p.name))
                    FILTER (WHERE i.id IS NOT NULL), '[]') AS items
           FROM purchase_orders po
           LEFT JOIN facilities f ON f.id = po.facility_id
           LEFT JOIN purchase_order_items i ON i.purchase_order_id = po.id
           LEFT JOIN products p ON p.id = i.product_id
           WHERE ($1::int IS NULL OR po.facility_id = $1)
             AND ($2 = 'any' OR po.direction = $2)
             AND ($3::text IS NULL OR po.status = $3)
           GROUP BY po.id, f.name
           ORDER BY po.updated_at DESC LIMIT 60`,
          [facility_id, direction, status]
        )
        return JSON.stringify(result.rows)
      },
    }),

    betaZodTool({
      name: 'consumption_history',
      description: 'Logged detergent usage, deliveries and adjustments over time. Use for questions about how much was actually used or delivered, and when.',
      inputSchema: z.object({
        facility_id: z.number().nullable(),
        days: z.number().describe('How far back to look, in days'),
      }),
      run: async ({ facility_id, days }) => {
        const result = await dbClient.query(
          `SELECT l.logged_at, l.type, l.quantity, l.notes, p.name AS product, f.name AS facility
           FROM consumption_logs l
           JOIN products p ON p.id = l.product_id
           LEFT JOIN facilities f ON f.id = l.facility_id
           WHERE ($1::int IS NULL OR l.facility_id = $1)
             AND l.logged_at > NOW() - ($2 || ' days')::interval
           ORDER BY l.logged_at DESC LIMIT 200`,
          [facility_id, String(Math.min(Math.max(Number(days) || 90, 1), 1095))]
        )
        return JSON.stringify(result.rows)
      },
    }),

    betaZodTool({
      name: 'list_sourcing_orders',
      description: 'Machines on order from overseas manufacturers, with build stage, container and shipping detail. Use for questions about what is being built or shipped.',
      inputSchema: z.object({
        stage: z.string().nullable().describe('Exact sourcing stage, or null for all'),
      }),
      run: async ({ stage }) => {
        const result = await dbClient.query(
          `SELECT so.id, so.supplier_name, so.supplier_country, so.quantity, so.stage, so.total_cost,
                  so.order_date, so.expected_ship_date, so.actual_ship_date, so.expected_arrival_date,
                  so.actual_arrival_date, so.container_number, so.vessel_name, so.carrier,
                  so.port_of_origin, so.port_of_destination, f.name AS destination_facility
           FROM machine_sourcing_orders so
           LEFT JOIN facilities f ON f.id = so.facility_id
           WHERE ($1::text IS NULL OR so.stage = $1)
           ORDER BY so.expected_arrival_date NULLS LAST LIMIT 60`,
          [stage]
        )
        return JSON.stringify(result.rows)
      },
    }),
  ]
}

// `history` is prior turns from the browser; roles are normalized and the
// length capped so a tampered client can't reshape the conversation.
export async function answerQuestion({ dbClient, snapshot, history, question }) {
  const priorTurns = (Array.isArray(history) ? history : [])
    .slice(-10)
    .filter((turn) => turn && typeof turn.content === 'string' && turn.content.trim())
    .map((turn) => ({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: turn.content.slice(0, 4000),
    }))

  const finalMessage = await client.beta.messages.toolRunner({
    model: 'claude-opus-5',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    max_iterations: 8,
    system: [
      { type: 'text', text: ASSISTANT_SYSTEM_PROMPT },
      { type: 'text', text: `Current account snapshot:\n${JSON.stringify(snapshot)}` },
    ],
    tools: buildTools(dbClient),
    messages: [...priorTurns, { role: 'user', content: question }],
  })

  const answer = finalMessage.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  return { answer, model: finalMessage.model }
}
