import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { SOURCING_STAGES } from '@/lib/constants'

export async function GET(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage')

  try {
    const rows = await withClient(async (client) => {
      let query = `
        SELECT so.*, f.name AS facility_name, p.title AS project_title, mm.name AS machine_model_name
        FROM machine_sourcing_orders so
        LEFT JOIN facilities f ON f.id = so.facility_id
        LEFT JOIN projects p ON p.id = so.project_id
        LEFT JOIN machine_models mm ON mm.id = so.machine_model_id
        WHERE 1=1
      `
      const params = []
      if (stage && SOURCING_STAGES.includes(stage)) {
        query += ' AND so.stage = $1'
        params.push(stage)
      }
      query += ' ORDER BY so.created_at DESC'

      const result = await client.query(query, params)
      return result.rows
    })

    return NextResponse.json({ sourcing_orders: rows })
  } catch (error) {
    console.error('Failed to list sourcing orders:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    if (!body.supplier_name) {
      return NextResponse.json({ error: 'supplier_name is required' }, { status: 400 })
    }
    const stage = SOURCING_STAGES.includes(body.stage) ? body.stage : 'order_placed'

    const sourcingOrder = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO machine_sourcing_orders (
           project_id, facility_id, machine_model_id, supplier_name, supplier_country, quantity, stage,
           order_date, deposit_amount, deposit_paid_date, total_cost, expected_ship_date, expected_arrival_date, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          body.project_id || null,
          body.facility_id || null,
          body.machine_model_id || null,
          body.supplier_name,
          body.supplier_country || null,
          body.quantity || 1,
          stage,
          body.order_date || null,
          body.deposit_amount || null,
          body.deposit_paid_date || null,
          body.total_cost || null,
          body.expected_ship_date || null,
          body.expected_arrival_date || null,
          body.notes || null,
        ]
      )
      const order = result.rows[0]

      await client.query(
        `INSERT INTO sourcing_order_events (sourcing_order_id, stage, notes) VALUES ($1, $2, $3)`,
        [order.id, stage, 'Order created']
      )

      return order
    })

    return NextResponse.json({ sourcing_order: sourcingOrder })
  } catch (error) {
    console.error('Failed to create sourcing order:', error)
    return NextResponse.json({ error: 'Failed to create sourcing order' }, { status: 500 })
  }
}
