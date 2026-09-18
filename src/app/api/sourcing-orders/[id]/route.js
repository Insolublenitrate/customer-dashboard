import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { SOURCING_STAGES } from '@/lib/constants'

export async function GET(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const data = await withClient(async (client) => {
      const orderResult = await client.query(
        `SELECT so.*, f.name AS facility_name, p.title AS project_title, mm.name AS machine_model_name
         FROM machine_sourcing_orders so
         LEFT JOIN facilities f ON f.id = so.facility_id
         LEFT JOIN projects p ON p.id = so.project_id
         LEFT JOIN machine_models mm ON mm.id = so.machine_model_id
         WHERE so.id = $1`,
        [id]
      )
      if (orderResult.rows.length === 0) return null

      const events = await client.query(
        `SELECT * FROM sourcing_order_events WHERE sourcing_order_id = $1 ORDER BY occurred_at DESC`,
        [id]
      )

      const machines = await client.query(
        `SELECT id, model, serial_number, facility_id, status FROM machines WHERE sourcing_order_id = $1`,
        [id]
      )

      return { sourcing_order: orderResult.rows[0], events: events.rows, machines: machines.rows }
    })

    if (!data) {
      return NextResponse.json({ error: 'Sourcing order not found' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to load sourcing order:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const body = await request.json()
    const stage = SOURCING_STAGES.includes(body.stage) ? body.stage : 'order_placed'

    const sourcingOrder = await withClient(async (client) => {
      const existing = await client.query('SELECT stage FROM machine_sourcing_orders WHERE id = $1', [id])
      if (existing.rows.length === 0) return null
      const stageChanged = existing.rows[0].stage !== stage

      const result = await client.query(
        `UPDATE machine_sourcing_orders SET
           project_id = $1, facility_id = $2, machine_model_id = $3, supplier_name = $4, supplier_country = $5,
           quantity = $6, stage = $7, order_date = $8, deposit_amount = $9, deposit_paid_date = $10, total_cost = $11,
           expected_ship_date = $12, actual_ship_date = $13, expected_arrival_date = $14, actual_arrival_date = $15,
           container_number = $16, vessel_name = $17, carrier = $18, port_of_origin = $19, port_of_destination = $20,
           tracking_url = $21, notes = $22, updated_at = NOW()
         WHERE id = $23
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
          body.actual_ship_date || null,
          body.expected_arrival_date || null,
          body.actual_arrival_date || null,
          body.container_number || null,
          body.vessel_name || null,
          body.carrier || null,
          body.port_of_origin || null,
          body.port_of_destination || null,
          body.tracking_url || null,
          body.notes || null,
          id,
        ]
      )

      if (stageChanged) {
        await client.query(
          `INSERT INTO sourcing_order_events (sourcing_order_id, stage, notes) VALUES ($1, $2, $3)`,
          [id, stage, body.stage_note || null]
        )
      }

      return result.rows[0]
    })

    if (!sourcingOrder) {
      return NextResponse.json({ error: 'Sourcing order not found' }, { status: 404 })
    }
    return NextResponse.json({ sourcing_order: sourcingOrder })
  } catch (error) {
    console.error('Failed to update sourcing order:', error)
    return NextResponse.json({ error: 'Failed to update sourcing order' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    await withClient((client) => client.query('DELETE FROM machine_sourcing_orders WHERE id = $1', [id]))
    return NextResponse.json({ message: 'Sourcing order deleted' })
  } catch (error) {
    console.error('Failed to delete sourcing order:', error)
    return NextResponse.json({ error: 'Failed to delete sourcing order' }, { status: 500 })
  }
}
