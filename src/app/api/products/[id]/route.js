import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { ProductSchema, validationError } from '@/lib/schemas'
import { computeStockForecast } from '@/lib/consumption'

export async function GET(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const data = await withClient(async (client) => {
      const productResult = await client.query('SELECT * FROM products WHERE id = $1', [id])
      if (productResult.rows.length === 0) return null
      const product = productResult.rows[0]

      // Where this product is stocked. The two sub-selects mirror the facility
      // stock route exactly — usage history, and the tank-based fallback for a
      // site that has machines but no logged usage yet — so the days-left figure
      // here agrees with the one on the facility page rather than quietly
      // disagreeing with it.
      const stock = await client.query(
        `SELECT cs.*, f.name AS facility_name,
           COALESCE((
             SELECT SUM(-quantity) FROM consumption_logs
             WHERE facility_id = cs.facility_id AND product_id = cs.product_id
               AND type = 'usage' AND logged_at > NOW() - INTERVAL '60 days'
           ), 0) AS usage_last_60_days,
           COALESCE((
             SELECT SUM(m.tank_capacity * 0.10 * m.fill_frequency_per_week)
             FROM machines m
             WHERE m.facility_id = cs.facility_id AND m.default_product_id = cs.product_id
               AND m.status IN ('active', 'needs_service')
               AND m.tank_capacity IS NOT NULL AND m.fill_frequency_per_week IS NOT NULL
           ), 0) AS planned_weekly_usage
         FROM consumable_stock cs
         JOIN facilities f ON f.id = cs.facility_id
         WHERE cs.product_id = $1
         ORDER BY f.name ASC`,
        [id]
      )

      const machines = await client.query(
        `SELECT m.id, m.model, m.serial_number, m.status, m.tank_capacity,
                m.fill_frequency_per_week, f.name AS facility_name
         FROM machines m
         JOIN facilities f ON f.id = m.facility_id
         WHERE m.default_product_id = $1
         ORDER BY f.name ASC, m.model ASC`,
        [id]
      )

      const logs = await client.query(
        `SELECT l.*, f.name AS facility_name
         FROM consumption_logs l
         JOIN facilities f ON f.id = l.facility_id
         WHERE l.product_id = $1
         ORDER BY l.logged_at DESC
         LIMIT 20`,
        [id]
      )

      const stockWithForecast = stock.rows.map((s) => ({
        ...s,
        ...computeStockForecast({
          quantityOnHand: s.quantity_on_hand,
          reorderThreshold: s.reorder_threshold,
          usageLast60Days: s.usage_last_60_days,
          reorderLeadTimeDays: product.reorder_lead_time_days,
          plannedWeeklyUsage: s.planned_weekly_usage,
        }),
      }))

      return {
        product,
        stock: stockWithForecast,
        machines: machines.rows,
        consumption_logs: logs.rows,
      }
    })

    if (!data) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to load product:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const parsed = ProductSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const body = parsed.data
    const product = await withClient(async (client) => {
      const result = await client.query(
        `UPDATE products SET name = $1, sku = $2, unit = $3, unit_price = $4, supplier_name = $5, reorder_lead_time_days = $6
         WHERE id = $7
         RETURNING *`,
        [
          body.name,
          body.sku,
          body.unit,
          body.unit_price,
          body.supplier_name,
          body.reorder_lead_time_days,
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
