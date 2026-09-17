import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { ACTION_ITEM_STATUSES } from '@/lib/constants'

export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const body = await request.json()

    const actionItem = await withClient(async (client) => {
      const current = await client.query('SELECT * FROM action_items WHERE id = $1', [id])
      if (current.rows.length === 0) return null
      const existing = current.rows[0]

      const description = body.description ?? existing.description
      const owner = body.owner !== undefined ? body.owner : existing.owner
      const dueDate = body.due_date !== undefined ? body.due_date : existing.due_date
      const status = ACTION_ITEM_STATUSES.includes(body.status) ? body.status : existing.status

      const result = await client.query(
        `UPDATE action_items SET description = $1, owner = $2, due_date = $3, status = $4 WHERE id = $5 RETURNING *`,
        [description, owner, dueDate, status, id]
      )
      return result.rows[0]
    })

    if (!actionItem) {
      return NextResponse.json({ error: 'Action item not found' }, { status: 404 })
    }
    return NextResponse.json({ action_item: actionItem })
  } catch (error) {
    console.error('Failed to update action item:', error)
    return NextResponse.json({ error: 'Failed to update action item' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    await withClient((client) => client.query('DELETE FROM action_items WHERE id = $1', [id]))
    return NextResponse.json({ message: 'Action item deleted' })
  } catch (error) {
    console.error('Failed to delete action item:', error)
    return NextResponse.json({ error: 'Failed to delete action item' }, { status: 500 })
  }
}
