import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { ContactSchema, validationError } from '@/lib/schemas'

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const parsed = ContactSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const data = parsed.data

    const contact = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO contacts (facility_id, name, title, email, phone, is_primary, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [data.facility_id, data.name, data.title, data.email, data.phone, data.is_primary, data.notes]
      )
      return result.rows[0]
    })

    return NextResponse.json({ contact })
  } catch (error) {
    console.error('Failed to create contact:', error)
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 })
  }
}
