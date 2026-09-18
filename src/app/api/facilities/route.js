import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { FacilitySchema, validationError } from '@/lib/schemas'

export async function GET() {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const rows = await withClient(async (client) => {
      const result = await client.query(`
        SELECT
          f.*,
          COUNT(DISTINCT p.id) FILTER (WHERE p.status NOT IN ('complete')) AS active_project_count,
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'open') AS open_action_item_count
        FROM facilities f
        LEFT JOIN projects p ON p.facility_id = f.id
        LEFT JOIN action_items a ON a.facility_id = f.id
        GROUP BY f.id
        ORDER BY f.is_mother_location DESC, f.name ASC
      `)
      return result.rows
    })
    return NextResponse.json({ facilities: rows })
  } catch (error) {
    console.error('Failed to list facilities:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const parsed = FacilitySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const data = parsed.data

    const facility = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO facilities (name, is_mother_location, address, city, state, zip, region, regulatory_notes, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          data.name, data.is_mother_location, data.address, data.city, data.state,
          data.zip, data.region, data.regulatory_notes, data.status,
        ]
      )
      return result.rows[0]
    })

    return NextResponse.json({ facility })
  } catch (error) {
    console.error('Failed to create facility:', error)
    return NextResponse.json({ error: 'Failed to create facility' }, { status: 500 })
  }
}
