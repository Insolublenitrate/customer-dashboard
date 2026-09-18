import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { ProjectSchema, validationError } from '@/lib/schemas'

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
    const parsed = ProjectSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const data = parsed.data

    const project = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO projects (facility_id, title, spec_summary, status, quote_value, target_date)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [data.facility_id, data.title, data.spec_summary, data.status, data.quote_value, data.target_date]
      )
      return result.rows[0]
    })

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Failed to create project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
