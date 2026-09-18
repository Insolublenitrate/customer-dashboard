import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { ProductSchema, validationError } from '@/lib/schemas'

export async function GET() {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const rows = await withClient(async (client) => {
      const result = await client.query('SELECT * FROM products ORDER BY name ASC')
      return result.rows
    })
    return NextResponse.json({ products: rows })
  } catch (error) {
    console.error('Failed to list products:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const parsed = ProductSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const data = parsed.data

    const product = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO products (name, sku, unit, unit_price, supplier_name, reorder_lead_time_days)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [data.name, data.sku, data.unit, data.unit_price, data.supplier_name, data.reorder_lead_time_days]
      )
      return result.rows[0]
    })

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Failed to create product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
