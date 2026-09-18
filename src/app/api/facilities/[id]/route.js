import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { FacilitySchema, validationError } from '@/lib/schemas'

export async function GET(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const data = await withClient(async (client) => {
      const facilityResult = await client.query('SELECT * FROM facilities WHERE id = $1', [id])
      if (facilityResult.rows.length === 0) return null

      const [contacts, projects, communications, actionItems] = await Promise.all([
        client.query('SELECT * FROM contacts WHERE facility_id = $1 ORDER BY is_primary DESC, name ASC', [id]),
        client.query('SELECT * FROM projects WHERE facility_id = $1 ORDER BY created_at DESC', [id]),
        client.query(
          'SELECT * FROM communications WHERE facility_id = $1 ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT 20',
          [id]
        ),
        client.query(
          "SELECT * FROM action_items WHERE facility_id = $1 ORDER BY (status = 'open') DESC, due_date ASC NULLS LAST",
          [id]
        ),
      ])

      return {
        facility: facilityResult.rows[0],
        contacts: contacts.rows,
        projects: projects.rows,
        communications: communications.rows,
        action_items: actionItems.rows,
      }
    })

    if (!data) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to load facility:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const parsed = FacilitySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const body = parsed.data
    const facility = await withClient(async (client) => {
      const result = await client.query(
        `UPDATE facilities SET
           name = $1, is_mother_location = $2, address = $3, city = $4, state = $5,
           zip = $6, region = $7, regulatory_notes = $8, status = $9
         WHERE id = $10
         RETURNING *`,
        [
          body.name,
          body.is_mother_location,
          body.address,
          body.city,
          body.state,
          body.zip,
          body.region,
          body.regulatory_notes,
          body.status || 'active',
          id,
        ]
      )
      return result.rows[0]
    })

    if (!facility) {
      return NextResponse.json({ error: 'Facility not found' }, { status: 404 })
    }
    return NextResponse.json({ facility })
  } catch (error) {
    console.error('Failed to update facility:', error)
    return NextResponse.json({ error: 'Failed to update facility' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    await withClient((client) => client.query('DELETE FROM facilities WHERE id = $1', [id]))
    return NextResponse.json({ message: 'Facility deleted' })
  } catch (error) {
    console.error('Failed to delete facility:', error)
    return NextResponse.json({ error: 'Failed to delete facility' }, { status: 500 })
  }
}
