import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { buildBusinessSnapshot } from '@/lib/businessSnapshot'
import { generateBriefing } from '@/lib/ai'

// Generating a briefing costs a Claude call and takes a while, so it is not
// regenerated on page load — the last one is stored and served until the owner
// asks for a fresh read.
export async function GET() {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const briefing = await withClient(async (client) => {
      const result = await client.query('SELECT * FROM ai_briefings ORDER BY generated_at DESC LIMIT 1')
      return result.rows[0] || null
    })
    return NextResponse.json({ briefing })
  } catch (error) {
    console.error('Failed to load briefing:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST() {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const { snapshot, facilityIds } = await withClient(async (client) => {
      const snap = await buildBusinessSnapshot(client)
      return { snapshot: snap, facilityIds: new Set(snap.facilities.map((f) => f.facility_id)) }
    })

    if (snapshot.facilities.length === 0) {
      return NextResponse.json({ error: 'No facilities to analyze yet' }, { status: 400 })
    }

    let result
    try {
      result = await generateBriefing(snapshot)
    } catch (err) {
      console.error('Claude briefing failed:', err)
      return NextResponse.json({ error: 'The analysis call failed. Try again.' }, { status: 502 })
    }

    // A hallucinated facility_id would render as a dead link, so anything that
    // isn't a real id is downgraded to an account-wide finding rather than dropped.
    const findings = result.parsed.findings.map((finding) => ({
      ...finding,
      facility_id: facilityIds.has(finding.facility_id) ? finding.facility_id : null,
    }))

    const briefing = await withClient(async (client) => {
      const inserted = await client.query(
        `INSERT INTO ai_briefings (headline, findings, model) VALUES ($1, $2, $3) RETURNING *`,
        [result.parsed.headline, JSON.stringify(findings), result.model]
      )
      return inserted.rows[0]
    })

    return NextResponse.json({ briefing })
  } catch (error) {
    console.error('Failed to generate briefing:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
