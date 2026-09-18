import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { MACHINE_STATUSES } from '@/lib/constants'

export async function GET(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const facilityId = searchParams.get('facility_id')

  try {
    const rows = await withClient(async (client) => {
      let query = `
        SELECT m.*, f.name AS facility_name, p.name AS default_product_name, mm.name AS machine_model_name
        FROM machines m
        JOIN facilities f ON f.id = m.facility_id
        LEFT JOIN products p ON p.id = m.default_product_id
        LEFT JOIN machine_models mm ON mm.id = m.machine_model_id
      `
      const params = []
      if (facilityId) {
        query += ' WHERE m.facility_id = $1'
        params.push(facilityId)
      }
      query += ' ORDER BY f.name ASC, m.created_at DESC'

      const result = await client.query(query, params)
      return result.rows
    })

    return NextResponse.json({ machines: rows })
  } catch (error) {
    console.error('Failed to list machines:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    if (!body.facility_id) {
      return NextResponse.json({ error: 'facility_id is required' }, { status: 400 })
    }
    const status = MACHINE_STATUSES.includes(body.status) ? body.status : 'active'

    const machine = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO machines (facility_id, project_id, machine_model_id, sourcing_order_id, serial_number, model, install_date, status, default_product_id, tank_capacity, fill_frequency_per_week, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          body.facility_id,
          body.project_id || null,
          body.machine_model_id || null,
          body.sourcing_order_id || null,
          body.serial_number || null,
          body.model || null,
          body.install_date || null,
          status,
          body.default_product_id || null,
          body.tank_capacity || null,
          body.fill_frequency_per_week || null,
          body.notes || null,
        ]
      )
      return result.rows[0]
    })

    return NextResponse.json({ machine })
  } catch (error) {
    console.error('Failed to create machine:', error)
    return NextResponse.json({ error: 'Failed to create machine' }, { status: 500 })
  }
}
