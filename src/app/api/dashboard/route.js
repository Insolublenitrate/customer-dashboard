import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { computeStockForecast } from '@/lib/consumption'

export async function GET() {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const data = await withClient(async (client) => {
      const [facilities, stats, overdue, stock, revenue] = await Promise.all([
        client.query('SELECT id, name, state, is_mother_location FROM facilities'),
        client.query(`
          SELECT
            (SELECT COUNT(*) FROM facilities) AS facility_count,
            (SELECT COUNT(*) FROM projects WHERE status <> 'complete') AS active_project_count,
            (SELECT COUNT(*) FROM action_items WHERE status = 'open') AS open_action_item_count,
            (SELECT COUNT(*) FROM communications WHERE created_at > NOW() - INTERVAL '7 days') AS recent_communication_count,
            (SELECT COALESCE(SUM(quote_value), 0) FROM projects WHERE status <> 'complete') AS pipeline_value,
            (SELECT COALESCE(SUM(total_value), 0) FROM purchase_orders WHERE direction = 'incoming' AND status NOT IN ('cancelled', 'fulfilled')) AS open_incoming_po_value,
            (SELECT COALESCE(SUM(total_value), 0) FROM purchase_orders WHERE direction = 'outgoing' AND status NOT IN ('cancelled', 'fulfilled')) AS open_outgoing_po_value
        `),
        client.query(`
          SELECT a.*, f.name AS facility_name
          FROM action_items a
          JOIN facilities f ON f.id = a.facility_id
          WHERE a.status = 'open' AND a.due_date IS NOT NULL AND a.due_date < CURRENT_DATE
          ORDER BY a.due_date ASC
          LIMIT 10
        `),
        client.query(`
          SELECT cs.*, f.name AS facility_name, p.name AS product_name, p.reorder_lead_time_days,
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
          JOIN products p ON p.id = cs.product_id
        `),
        client.query(`
          SELECT DATE_TRUNC('month', updated_at) AS month, COALESCE(SUM(total_value), 0) AS revenue
          FROM purchase_orders
          WHERE direction = 'incoming' AND status = 'fulfilled' AND updated_at > NOW() - INTERVAL '6 months'
          GROUP BY 1
          ORDER BY 1 ASC
        `),
      ])

      const needsReorder = stock.rows
        .map((s) => ({
          ...s,
          ...computeStockForecast({
            quantityOnHand: s.quantity_on_hand,
            reorderThreshold: s.reorder_threshold,
            usageLast60Days: s.usage_last_60_days,
            reorderLeadTimeDays: s.reorder_lead_time_days,
            plannedWeeklyUsage: s.planned_weekly_usage,
          }),
        }))
        .filter((s) => s.flagged)

      return {
        facilities: facilities.rows,
        stats: stats.rows[0],
        overdue_action_items: overdue.rows,
        needs_reorder: needsReorder,
        monthly_revenue: revenue.rows,
      }
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to load dashboard:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
