import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'

export async function GET() {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const rows = await withClient(async (client) => {
      const result = await client.query('SELECT * FROM machine_models ORDER BY name ASC')
      return result.rows
    })
    return NextResponse.json({ machine_models: rows })
  } catch (error) {
    console.error('Failed to list machine models:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const body = await request.json()
    if (!body.name || !body.tank_capacity) {
      return NextResponse.json({ error: 'name and tank_capacity are required' }, { status: 400 })
    }

    const machineModel = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO machine_models (name, tank_capacity, fill_frequency_per_week, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [body.name, body.tank_capacity, body.fill_frequency_per_week || null, body.notes || null]
      )
      return result.rows[0]
    })

    return NextResponse.json({ machine_model: machineModel })
  } catch (error) {
    console.error('Failed to create machine model:', error)
    return NextResponse.json({ error: 'Failed to create machine model' }, { status: 500 })
  }
}
