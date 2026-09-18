import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { PROJECT_STATUSES } from '@/lib/constants'

export async function GET() {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const rows = await withClient(async (client) => {
      const result = await client.query(`
        SELECT p.*, f.name AS facility_name
        FROM projects p
        JOIN facilities f ON f.id = p.facility_id
        ORDER BY p.created_at DESC
      `)
      return result.rows
    })
    return NextResponse.json({ projects: rows })
  } catch (error) {
    console.error('Failed to list projects:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    if (!body.facility_id || !body.title) {
      return NextResponse.json({ error: 'facility_id and title are required' }, { status: 400 })
    }
    const status = PROJECT_STATUSES.includes(body.status) ? body.status : 'discovery'

    const project = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO projects (facility_id, title, spec_summary, status, quote_value, target_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [body.facility_id, body.title, body.spec_summary || null, status, body.quote_value || null, body.target_date || null]
      )
      return result.rows[0]
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
