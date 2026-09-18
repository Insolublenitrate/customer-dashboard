import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

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
