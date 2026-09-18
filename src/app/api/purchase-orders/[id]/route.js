import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { PO_STATUSES } from '@/lib/constants'

export async function GET(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const data = await withClient(async (client) => {
      const poResult = await client.query(
        `SELECT po.*, f.name AS facility_name
         FROM purchase_orders po
         LEFT JOIN facilities f ON f.id = po.facility_id
         WHERE po.id = $1`,
        [id]
      )
      if (poResult.rows.length === 0) return null

      const items = await client.query(
        `SELECT i.*, p.name AS product_name
         FROM purchase_order_items i
         LEFT JOIN products p ON p.id = i.product_id
         WHERE i.purchase_order_id = $1
         ORDER BY i.id ASC`,
        [id]
      )

      return { ...poResult.rows[0], items: items.rows }
    })

    if (!data) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    return NextResponse.json({ purchase_order: data })
  } catch (error) {
    console.error('Failed to load purchase order:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Updates PO fields; when `items` is provided, replaces the full line-item
// set (simplest correct behavior for a small, form-driven line-item list).
export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const body = await request.json()
    const status = PO_STATUSES.includes(body.status) ? body.status : 'draft'

    const purchaseOrder = await withClient(async (client) => {
      const poResult = await client.query(
        `UPDATE purchase_orders SET
           status = $1, po_number = $2, expected_date = $3, total_value = $4, notes = $5, updated_at = NOW()
         WHERE id = $6
         RETURNING *`,
        [status, body.po_number || null, body.expected_date || null, body.total_value || null, body.notes || null, id]
      )
      if (poResult.rows.length === 0) return null
      const po = poResult.rows[0]

      if (Array.isArray(body.items)) {
        await client.query('DELETE FROM purchase_order_items WHERE purchase_order_id = $1', [id])
        for (const item of body.items) {
          await client.query(
            `INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_price)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, item.product_id || null, item.description || null, item.quantity || 1, item.unit_price || null]
          )
        }
      }

      const items = await client.query(
        `SELECT i.*, p.name AS product_name FROM purchase_order_items i
         LEFT JOIN products p ON p.id = i.product_id
         WHERE i.purchase_order_id = $1 ORDER BY i.id ASC`,
        [id]
      )

      return { ...po, items: items.rows }
    })

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }
    return NextResponse.json({ purchase_order: purchaseOrder })
  } catch (error) {
    console.error('Failed to update purchase order:', error)
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    await withClient((client) => client.query('DELETE FROM purchase_orders WHERE id = $1', [id]))
    return NextResponse.json({ message: 'Purchase order deleted' })
  } catch (error) {
    console.error('Failed to delete purchase order:', error)
    return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 })
  }
}
