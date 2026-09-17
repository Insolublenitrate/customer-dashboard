import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'

export async function GET() {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const data = await withClient(async (client) => {
      const [facilities, stats, overdue] = await Promise.all([
        client.query('SELECT id, name, state, is_mother_location FROM facilities'),
        client.query(`
          SELECT
            (SELECT COUNT(*) FROM facilities) AS facility_count,
            (SELECT COUNT(*) FROM projects WHERE status <> 'complete') AS active_project_count,
            (SELECT COUNT(*) FROM action_items WHERE status = 'open') AS open_action_item_count,
            (SELECT COUNT(*) FROM communications WHERE created_at > NOW() - INTERVAL '7 days') AS recent_communication_count
        `),
        client.query(`
          SELECT a.*, f.name AS facility_name
          FROM action_items a
          JOIN facilities f ON f.id = a.facility_id
          WHERE a.status = 'open' AND a.due_date IS NOT NULL AND a.due_date < CURRENT_DATE
          ORDER BY a.due_date ASC
          LIMIT 10
        `),
      ])

      return {
        facilities: facilities.rows,
        stats: stats.rows[0],
        overdue_action_items: overdue.rows,
      }
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to load dashboard:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
