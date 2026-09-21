import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { MachineSchema, validationError } from '@/lib/schemas'
import { readPaging, searchClause, pagedResult } from '@/lib/pagination'

export async function GET(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const facilityId = searchParams.get('facility_id')
  const { limit, offset, q } = readPaging(searchParams)

  try {
    const rows = await withClient(async (client) => {
      let query = `
        SELECT m.*, f.name AS facility_name, p.name AS default_product_name, mm.name AS machine_model_name,
               COUNT(*) OVER() AS total_count
        FROM machines m
        JOIN facilities f ON f.id = m.facility_id
        LEFT JOIN products p ON p.id = m.default_product_id
        LEFT JOIN machine_models mm ON mm.id = m.machine_model_id
        WHERE 1=1
      `
      const params = []
      if (facilityId) {
        params.push(facilityId)
        query += ` AND m.facility_id = $${params.length}`
      }
      // Search covers what someone would actually type looking for a unit.
      const search = searchClause(
        ['m.model', 'm.serial_number', 'f.name', 'mm.name'], q, params.length + 1
      )
      query += search.sql
      params.push(...search.params)

      // A stable tiebreaker on id: without it two machines sorting equally can
      // swap between pages, so one is shown twice and another never.
      query += ' ORDER BY f.name ASC, m.created_at DESC, m.id DESC'
      params.push(limit, offset)
      query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`

      const result = await client.query(query, params)
      return result.rows
    })

    const page = pagedResult(rows, { limit, offset })
    // `machines` is kept so existing callers that only read the array still
    // work; the paging fields ride alongside it.
    return NextResponse.json({ machines: page.items, ...page })
  } catch (error) {
    console.error('Failed to list machines:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const parsed = MachineSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const data = parsed.data

    const machine = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO machines (facility_id, project_id, machine_model_id, sourcing_order_id, serial_number, model, install_date, status, default_product_id, tank_capacity, fill_frequency_per_week, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          data.facility_id, data.project_id, data.machine_model_id, data.sourcing_order_id,
          data.serial_number, data.model, data.install_date, data.status,
          data.default_product_id, data.tank_capacity, data.fill_frequency_per_week, data.notes,
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
