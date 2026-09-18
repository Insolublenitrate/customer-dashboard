import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'

export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const body = await request.json()
    const machineModel = await withClient(async (client) => {
      const result = await client.query(
        `UPDATE machine_models SET name = $1, tank_capacity = $2, fill_frequency_per_week = $3, notes = $4
         WHERE id = $5
         RETURNING *`,
        [body.name, body.tank_capacity, body.fill_frequency_per_week || null, body.notes || null, id]
      )
      return result.rows[0]
    })

    if (!machineModel) {
      return NextResponse.json({ error: 'Machine model not found' }, { status: 404 })
    }
    return NextResponse.json({ machine_model: machineModel })
  } catch (error) {
    console.error('Failed to update machine model:', error)
    return NextResponse.json({ error: 'Failed to update machine model' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    await withClient((client) => client.query('DELETE FROM machine_models WHERE id = $1', [id]))
    return NextResponse.json({ message: 'Machine model deleted' })
  } catch (error) {
    console.error('Failed to delete machine model:', error)
    return NextResponse.json({ error: 'Failed to delete machine model' }, { status: 500 })
  }
}
