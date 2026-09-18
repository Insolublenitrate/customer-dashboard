import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { ContactUpdateSchema, validationError } from '@/lib/schemas'

export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const parsed = ContactUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const body = parsed.data
    const contact = await withClient(async (client) => {
      const result = await client.query(
        `UPDATE contacts SET
           name = $1, title = $2, email = $3, phone = $4, is_primary = $5, notes = $6
         WHERE id = $7
         RETURNING *`,
        [body.name, body.title, body.email, body.phone, body.is_primary, body.notes, id]
      )
      return result.rows[0]
    })

    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    return NextResponse.json({ contact })
  } catch (error) {
    console.error('Failed to update contact:', error)
    return NextResponse.json({ error: 'Failed to update contact' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    await withClient((client) => client.query('DELETE FROM contacts WHERE id = $1', [id]))
    return NextResponse.json({ message: 'Contact deleted' })
  } catch (error) {
    console.error('Failed to delete contact:', error)
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 })
  }
}
