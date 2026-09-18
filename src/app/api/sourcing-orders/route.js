import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { SourcingOrderSchema, validationError } from '@/lib/schemas'
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
    const parsed = SourcingOrderSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const data = parsed.data

    const sourcingOrder = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO machine_sourcing_orders (
           project_id, facility_id, machine_model_id, supplier_name, supplier_country, quantity, stage,
           order_date, deposit_amount, deposit_paid_date, total_cost, expected_ship_date, expected_arrival_date, notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          data.project_id, data.facility_id, data.machine_model_id, data.supplier_name,
          data.supplier_country, data.quantity, data.stage, data.order_date,
          data.deposit_amount, data.deposit_paid_date, data.total_cost,
          data.expected_ship_date, data.expected_arrival_date, data.notes,
        ]
      )
      const order = result.rows[0]

      await client.query(
        `INSERT INTO sourcing_order_events (sourcing_order_id, stage, notes) VALUES ($1, $2, $3)`,
        [order.id, data.stage, 'Order created']
      )

      return order
    })

    return NextResponse.json({ sourcing_order: sourcingOrder })
  } catch (error) {
    console.error('Failed to create sourcing order:', error)
    return NextResponse.json({ error: 'Failed to create sourcing order' }, { status: 500 })
  }
}
