import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { PurchaseOrderSchema, validationError } from '@/lib/schemas'
import { PO_DIRECTIONS, PO_STATUSES } from '@/lib/constants'

export async function GET(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const direction = searchParams.get('direction')
  const status = searchParams.get('status')

  try {
    const rows = await withClient(async (client) => {
      let query = `
        SELECT po.*, f.name AS facility_name,
          (SELECT COUNT(*) FROM purchase_order_items i WHERE i.purchase_order_id = po.id) AS item_count
        FROM purchase_orders po
        LEFT JOIN facilities f ON f.id = po.facility_id
        WHERE 1=1
      `
      const params = []
      let i = 1

      if (direction && PO_DIRECTIONS.includes(direction)) {
        query += ` AND po.direction = $${i}`
        params.push(direction)
        i++
      }
      if (status && PO_STATUSES.includes(status)) {
        query += ` AND po.status = $${i}`
        params.push(status)
        i++
      }

      query += ' ORDER BY po.created_at DESC'
      const result = await client.query(query, params)
      return result.rows
    })

    return NextResponse.json({ purchase_orders: rows })
  } catch (error) {
    console.error('Failed to list purchase orders:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const parsed = PurchaseOrderSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const data = parsed.data
    const items = data.items

    const computedTotal = items.reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0)

    const purchaseOrder = await withClient(async (client) => {
      const poResult = await client.query(
        `INSERT INTO purchase_orders (direction, facility_id, supplier_name, status, po_number, expected_date, total_value, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          data.direction,
          data.direction === 'incoming' ? data.facility_id : null,
          data.direction === 'outgoing' ? data.supplier_name : null,
          data.status, data.po_number, data.expected_date,
          data.total_value ?? (computedTotal || null), data.notes,
        ]
      )
      const po = poResult.rows[0]

      const insertedItems = []
      for (const item of items) {
        const itemResult = await client.query(
          `INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [po.id, item.product_id, item.description, item.quantity, item.unit_price]
        )
        insertedItems.push(itemResult.rows[0])
      }

      return { ...po, items: insertedItems }
    })

    return NextResponse.json({ purchase_order: purchaseOrder })
  } catch (error) {
    console.error('Failed to create purchase order:', error)
    return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 })
  }
}
