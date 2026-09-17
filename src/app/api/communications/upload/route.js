import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { uploadCommunicationFile } from '@/lib/blob'
import { extractText } from '@/lib/extractText'
import { analyzeCommunication } from '@/lib/ai'
import { COMMUNICATION_TYPES } from '@/lib/constants'

export async function POST(request) {
  const { session, unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const pastedText = formData.get('text')
    const typeField = formData.get('type')
    const facilityIdField = formData.get('facility_id')

    const type = COMMUNICATION_TYPES.includes(typeField) ? typeField : 'other'
    const facilityIdHint = facilityIdField ? Number(facilityIdField) : null

    if (!file && !pastedText) {
      return NextResponse.json({ error: 'Provide a file or pasted text' }, { status: 400 })
    }

    let sourceFilename = null
    let storageUrl = null
    let extracted = { text: pastedText || null, isPdf: false, occurredAt: null }

    if (file) {
      sourceFilename = file.name
      const buffer = Buffer.from(await file.arrayBuffer())

      try {
        extracted = await extractText(buffer, file.name)
      } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }

      const blob = await uploadCommunicationFile(buffer, file.name, file.type)
      storageUrl = blob.url

      if (extracted.isPdf) {
        extracted.pdfBase64 = buffer.toString('base64')
      }
    }

    const facilities = await withClient((client) => client.query('SELECT id, name FROM facilities'))
    const facilityNames = facilities.rows.map((f) => f.name)

    let analysis
    try {
      analysis = await analyzeCommunication({
        text: extracted.text,
        pdfBase64: extracted.pdfBase64,
        facilityNames,
      })
    } catch (err) {
      console.error('Claude analysis failed:', err)
      analysis = null
    }

    let facilityId = facilityIdHint
    if (!facilityId && analysis?.facility_guess) {
      const guess = analysis.facility_guess.toLowerCase()
      const match = facilities.rows.find(
        (f) => f.name.toLowerCase() === guess || f.name.toLowerCase().includes(guess) || guess.includes(f.name.toLowerCase())
      )
      if (match) facilityId = match.id
    }

    const communication = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO communications
           (facility_id, type, source_filename, storage_url, raw_text, ai_summary, occurred_at, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          facilityId,
          type,
          sourceFilename,
          storageUrl,
          extracted.text,
          analysis?.summary || null,
          extracted.occurredAt,
          session.user.id,
        ]
      )
      const row = result.rows[0]

      const actionItems = []
      if (facilityId && analysis?.action_items?.length) {
        for (const item of analysis.action_items) {
          const itemResult = await client.query(
            `INSERT INTO action_items (facility_id, communication_id, description, owner, due_date)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [facilityId, row.id, item.description, item.owner || null, item.due_date || null]
          )
          actionItems.push(itemResult.rows[0])
        }
      }

      return { ...row, action_items: actionItems }
    })

    return NextResponse.json({ communication, needs_facility: !facilityId })
  } catch (error) {
    console.error('Failed to process upload:', error)
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 })
  }
}
