import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { MachineModelSchema, validationError } from '@/lib/schemas'

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
    const parsed = MachineModelSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const data = parsed.data

    const machineModel = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO machine_models (name, tank_capacity, fill_frequency_per_week, notes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [data.name, data.tank_capacity, data.fill_frequency_per_week, data.notes]
      )
      return result.rows[0]
    })

    return NextResponse.json({ machine_model: machineModel })
  } catch (error) {
    console.error('Failed to create machine model:', error)
    return NextResponse.json({ error: 'Failed to create machine model' }, { status: 500 })
  }
}
