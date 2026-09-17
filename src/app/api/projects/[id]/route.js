import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { PROJECT_STATUSES } from '@/lib/constants'

export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const body = await request.json()
    const status = PROJECT_STATUSES.includes(body.status) ? body.status : 'discovery'

    const project = await withClient(async (client) => {
      const result = await client.query(
        `UPDATE projects SET
           title = $1, spec_summary = $2, status = $3, quote_value = $4, target_date = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [body.title, body.spec_summary || null, status, body.quote_value || null, body.target_date || null, id]
      )
      return result.rows[0]
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    return NextResponse.json({ project })
  } catch (error) {
    console.error('Failed to update project:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    await withClient((client) => client.query('DELETE FROM projects WHERE id = $1', [id]))
    return NextResponse.json({ message: 'Project deleted' })
  } catch (error) {
    console.error('Failed to delete project:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
