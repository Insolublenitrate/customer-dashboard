import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { ConsumptionLogSchema, validationError } from '@/lib/schemas'
import { computeStockForecast } from '@/lib/consumption'

export async function GET(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const data = await withClient(async (client) => {
      const stock = await client.query(
        `SELECT cs.*, p.name AS product_name, p.unit AS product_unit, p.reorder_lead_time_days,
           COALESCE((
             SELECT SUM(-quantity) FROM consumption_logs
             WHERE facility_id = cs.facility_id AND product_id = cs.product_id
               AND type = 'usage' AND logged_at > NOW() - INTERVAL '60 days'
           ), 0) AS usage_last_60_days,
           COALESCE((
             -- Theoretical draw for machines running this product: 10% of each
             -- tank fill is detergent (see DETERGENT_RATIO in src/lib/consumption.js).
             SELECT SUM(m.tank_capacity * 0.10 * m.fill_frequency_per_week)
             FROM machines m
             WHERE m.facility_id = cs.facility_id AND m.default_product_id = cs.product_id
               AND m.status IN ('active', 'needs_service')
               AND m.tank_capacity IS NOT NULL AND m.fill_frequency_per_week IS NOT NULL
           ), 0) AS planned_weekly_usage
         FROM consumable_stock cs
         JOIN products p ON p.id = cs.product_id
         WHERE cs.facility_id = $1
         ORDER BY p.name ASC`,
        [id]
      )

      const logs = await client.query(
        `SELECT l.*, p.name AS product_name
         FROM consumption_logs l
         JOIN products p ON p.id = l.product_id
         WHERE l.facility_id = $1
         ORDER BY l.logged_at DESC
         LIMIT 30`,
        [id]
      )

      const stockWithForecast = stock.rows.map((s) => ({
        ...s,
        ...computeStockForecast({
          quantityOnHand: s.quantity_on_hand,
          reorderThreshold: s.reorder_threshold,
          usageLast60Days: s.usage_last_60_days,
          reorderLeadTimeDays: s.reorder_lead_time_days,
          plannedWeeklyUsage: s.planned_weekly_usage,
        }),
      }))

      return { stock: stockWithForecast, consumption_logs: logs.rows }
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to load facility stock:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Logs a usage/delivery/adjustment event and updates the running on-hand
// total in the same transaction. `quantity` is always a positive number the
// caller enters; its meaning depends on `type`:
//   usage      - amount consumed (stock decreases, logged as negative)
//   delivery   - amount received (stock increases, logged as positive)
//   adjustment - new absolute on-hand value (logged as the delta applied,
//                so summing all logged quantities always reconstructs stock)
export async function POST(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const parsed = ConsumptionLogSchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json(validationError(parsed), { status: 400 })
    const body = parsed.data
    const type = body.type
    const enteredQuantity = body.quantity

    const result = await withClient(async (client) => {
      const existing = await client.query(
        'SELECT * FROM consumable_stock WHERE facility_id = $1 AND product_id = $2',
        [id, body.product_id]
      )
      const currentQuantity = existing.rows[0] ? Number(existing.rows[0].quantity_on_hand) : 0

      let delta
      if (type === 'usage') delta = -enteredQuantity
      else if (type === 'delivery') delta = enteredQuantity
      else delta = enteredQuantity - currentQuantity // adjustment: entered value is the new absolute total

      const newQuantity = currentQuantity + delta

      if (existing.rows[0]) {
        await client.query(
          'UPDATE consumable_stock SET quantity_on_hand = $1, updated_at = NOW() WHERE id = $2',
          [newQuantity, existing.rows[0].id]
        )
      } else {
        await client.query(
          `INSERT INTO consumable_stock (facility_id, product_id, quantity_on_hand, reorder_threshold, unit)
           VALUES ($1, $2, $3, 0, $4)`,
          [id, body.product_id, newQuantity, body.unit || 'gallon']
        )
      }

      const logResult = await client.query(
        `INSERT INTO consumption_logs (facility_id, product_id, machine_id, type, quantity, logged_at, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          id,
          body.product_id,
          body.machine_id || null,
          type,
          delta,
          body.logged_at || new Date().toISOString(),
          body.notes || null,
        ]
      )

      return { log: logResult.rows[0], quantity_on_hand: newQuantity }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Failed to log consumption:', error)
    return NextResponse.json({ error: 'Failed to log consumption' }, { status: 500 })
  }
}

// Sets the reorder threshold for a facility+product, creating the stock row
// (at 0 on-hand) if this product hasn't been tracked at this facility yet.
export async function PUT(request, { params }) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { id } = await params

  try {
    const body = await request.json()
    if (!body.product_id || body.reorder_threshold === undefined) {
      return NextResponse.json({ error: 'product_id and reorder_threshold are required' }, { status: 400 })
    }

    const stock = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO consumable_stock (facility_id, product_id, quantity_on_hand, reorder_threshold, unit)
         VALUES ($1, $2, 0, $3, $4)
         ON CONFLICT (facility_id, product_id)
         DO UPDATE SET reorder_threshold = EXCLUDED.reorder_threshold, updated_at = NOW()
         RETURNING *`,
        [id, body.product_id, body.reorder_threshold, body.unit || 'gallon']
      )
      return result.rows[0]
    })

    return NextResponse.json({ stock })
  } catch (error) {
    console.error('Failed to update reorder threshold:', error)
    return NextResponse.json({ error: 'Failed to update reorder threshold' }, { status: 500 })
  }
}
