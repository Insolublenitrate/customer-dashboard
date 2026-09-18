import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'

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
    const body = await request.json()
    if (!body.name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const product = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO products (name, sku, unit, unit_price, supplier_name, reorder_lead_time_days)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          body.name,
          body.sku || null,
          body.unit || 'gallon',
          body.unit_price || null,
          body.supplier_name || null,
          body.reorder_lead_time_days || 14,
        ]
      )
      return result.rows[0]
    })

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Failed to create product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
