import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    if (!body.facility_id || !body.name) {
      return NextResponse.json({ error: 'facility_id and name are required' }, { status: 400 })
    }

    const contact = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO contacts (facility_id, name, title, email, phone, is_primary, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          body.facility_id,
          body.name,
          body.title || null,
          body.email || null,
          body.phone || null,
          !!body.is_primary,
          body.notes || null,
        ]
      )
      return result.rows[0]
    })

    return NextResponse.json({ contact })
  } catch (error) {
    console.error('Failed to create contact:', error)
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
  }
}
