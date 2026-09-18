import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { MachineUpdateSchema, validationError } from '@/lib/schemas'
import { MACHINE_STATUSES } from '@/lib/constants'

export async function GET(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const data = await withClient(async (client) => {
      const machineResult = await client.query(
        `SELECT m.*, f.name AS facility_name, p.title AS project_title, prod.name AS default_product_name,
           mm.name AS machine_model_name, so.supplier_name AS sourcing_supplier_name
         FROM machines m
         JOIN facilities f ON f.id = m.facility_id
         LEFT JOIN projects p ON p.id = m.project_id
         LEFT JOIN products prod ON prod.id = m.default_product_id
         LEFT JOIN machine_models mm ON mm.id = m.machine_model_id
         LEFT JOIN machine_sourcing_orders so ON so.id = m.sourcing_order_id
         WHERE m.id = $1`,
        [id]
      )
      if (machineResult.rows.length === 0) return null

      const logs = await client.query(
        `SELECT l.*, prod.name AS product_name
         FROM consumption_logs l
         JOIN products prod ON prod.id = l.product_id
         WHERE l.machine_id = $1
         ORDER BY l.logged_at DESC
         LIMIT 20`,
        [id]
      )

      return { machine: machineResult.rows[0], consumption_logs: logs.rows }
    })

    if (!data) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to load machine:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const parsed = MachineUpdateSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const body = parsed.data
    const status = body.status

    const machine = await withClient(async (client) => {
      const result = await client.query(
        `UPDATE machines SET
           machine_model_id = $1, sourcing_order_id = $2, serial_number = $3, model = $4, install_date = $5, status = $6,
           default_product_id = $7, tank_capacity = $8, fill_frequency_per_week = $9, notes = $10
         WHERE id = $11
         RETURNING *`,
        [
          body.machine_model_id,
          body.sourcing_order_id,
          body.serial_number,
          body.model,
          body.install_date,
          status,
          body.default_product_id,
          body.tank_capacity,
          body.fill_frequency_per_week,
          body.notes,
          id,
        ]
      )
      return result.rows[0]
    })

    if (!machine) {
      return NextResponse.json({ error: 'Machine not found' }, { status: 404 })
    }
    return NextResponse.json({ machine })
  } catch (error) {
    console.error('Failed to update machine:', error)
    return NextResponse.json({ error: 'Failed to update machine' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    await withClient((client) => client.query('DELETE FROM machines WHERE id = $1', [id]))
    return NextResponse.json({ message: 'Machine deleted' })
  } catch (error) {
    console.error('Failed to delete machine:', error)
    return NextResponse.json({ error: 'Failed to delete machine' }, { status: 500 })
  }
}
