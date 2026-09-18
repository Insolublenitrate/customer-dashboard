import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { ActionItemCreateSchema, validationError } from '@/lib/schemas'
import { ACTION_ITEM_STATUSES } from '@/lib/constants'

export async function GET(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const facilityId = searchParams.get('facility_id')

  try {
    const rows = await withClient(async (client) => {
      let query = `
        SELECT a.*, f.name AS facility_name
        FROM action_items a
        JOIN facilities f ON f.id = a.facility_id
        WHERE 1=1
      `
      const params = []
      let i = 1

      if (status && ACTION_ITEM_STATUSES.includes(status)) {
        query += ` AND a.status = $${i}`
        params.push(status)
        i++
      }
      if (facilityId) {
        query += ` AND a.facility_id = $${i}`
        params.push(facilityId)
        i++
      }

      query += ` ORDER BY (a.status = 'open') DESC, a.due_date ASC NULLS LAST, a.created_at DESC`
      const result = await client.query(query, params)
      return result.rows
    })

    return NextResponse.json({ action_items: rows })
  } catch (error) {
    console.error('Failed to list action items:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const parsed = ActionItemCreateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const body = parsed.data

    const actionItem = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO action_items (facility_id, project_id, description, owner, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          body.facility_id,
          body.project_id,
          body.description,
          body.owner,
          body.due_date,
          body.status,
        ]
      )
      return result.rows[0]
    })

    return NextResponse.json({ action_item: actionItem })
  } catch (error) {
    console.error('Failed to create action item:', error)
    return NextResponse.json({ error: 'Failed to create action item' }, { status: 500 })
  }
}
