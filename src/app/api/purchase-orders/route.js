import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
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
    const body = await request.json()
    const direction = PO_DIRECTIONS.includes(body.direction) ? body.direction : 'incoming'
    const status = PO_STATUSES.includes(body.status) ? body.status : 'draft'
    const items = Array.isArray(body.items) ? body.items : []

    if (direction === 'incoming' && !body.facility_id) {
      return NextResponse.json({ error: 'facility_id is required for incoming orders' }, { status: 400 })
    }
    if (direction === 'outgoing' && !body.supplier_name) {
      return NextResponse.json({ error: 'supplier_name is required for outgoing orders' }, { status: 400 })
    }

    const computedTotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)

    const purchaseOrder = await withClient(async (client) => {
      const poResult = await client.query(
        `INSERT INTO purchase_orders (direction, facility_id, supplier_name, status, po_number, expected_date, total_value, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          direction,
          direction === 'incoming' ? body.facility_id : null,
          direction === 'outgoing' ? body.supplier_name : null,
          status,
          body.po_number || null,
          body.expected_date || null,
          body.total_value || computedTotal || null,
          body.notes || null,
        ]
      )
      const po = poResult.rows[0]

      const insertedItems = []
      for (const item of items) {
        const itemResult = await client.query(
          `INSERT INTO purchase_order_items (purchase_order_id, product_id, description, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`,
          [po.id, item.product_id || null, item.description || null, item.quantity || 1, item.unit_price || null]
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
