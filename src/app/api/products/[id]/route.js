import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'

export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const body = await request.json()
    const product = await withClient(async (client) => {
      const result = await client.query(
        `UPDATE products SET name = $1, sku = $2, unit = $3, unit_price = $4, supplier_name = $5, reorder_lead_time_days = $6
         WHERE id = $7
         RETURNING *`,
        [
          body.name,
          body.sku || null,
          body.unit || 'gallon',
          body.unit_price || null,
          body.supplier_name || null,
          body.reorder_lead_time_days || 14,
          id,
        ]
      )
      return result.rows[0]
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json({ product })
  } catch (error) {
    console.error('Failed to update product:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    await withClient((client) => client.query('DELETE FROM products WHERE id = $1', [id]))
    return NextResponse.json({ message: 'Product deleted' })
  } catch (error) {
    console.error('Failed to delete product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
