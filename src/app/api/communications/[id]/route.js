import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'

// Used for the manual "link to facility" control when the AI matcher
// couldn't confidently guess one.
export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const body = await request.json()
    if (!body.facility_id) {
      return NextResponse.json({ error: 'facility_id is required' }, { status: 400 })
    }

    const communication = await withClient(async (client) => {
      const result = await client.query(
        `UPDATE communications SET facility_id = $1 WHERE id = $2 RETURNING *`,
        [body.facility_id, id]
      )
      return result.rows[0]
    })

    if (!communication) {
      return NextResponse.json({ error: 'Communication not found' }, { status: 404 })
    }
    return NextResponse.json({ communication })
  } catch (error) {
    console.error('Failed to update communication:', error)
    return NextResponse.json({ error: 'Failed to update communication' }, { status: 500 })
  }
}
