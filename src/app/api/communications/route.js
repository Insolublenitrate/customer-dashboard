import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'

export async function GET(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const facilityId = searchParams.get('facility_id')

  try {
    const rows = await withClient(async (client) => {
      let query = `
        SELECT c.*, f.name AS facility_name,
          (SELECT COUNT(*) FROM action_items a WHERE a.communication_id = c.id) AS action_item_count
        FROM communications c
        LEFT JOIN facilities f ON f.id = c.facility_id
      `
      const params = []
      if (facilityId) {
        query += ' WHERE c.facility_id = $1'
        params.push(facilityId)
      }
      query += ' ORDER BY COALESCE(c.occurred_at, c.created_at) DESC LIMIT 100'

      const result = await client.query(query, params)
      return result.rows
    })

    return NextResponse.json({ communications: rows })
  } catch (error) {
    console.error('Failed to list communications:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
