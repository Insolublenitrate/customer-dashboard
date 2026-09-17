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
