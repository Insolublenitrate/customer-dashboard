import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { PROJECT_STATUSES, SOURCING_STAGES } from '@/lib/constants'
import { computeStockForecast } from '@/lib/consumption'

export async function GET() {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  try {
    const data = await withClient(async (client) => {
      const [leaderboard, stock, deltas, revenueTrend, pipelineByStage, machineStatus, poStatus, fleetDemand, sourcingStage, arrivingSoon] = await Promise.all([
        client.query(`
          SELECT
            f.id, f.name, f.is_mother_location,
            COALESCE((SELECT SUM(quote_value) FROM projects WHERE facility_id = f.id), 0) AS pipeline_value,
            COALESCE((SELECT SUM(total_value) FROM purchase_orders WHERE facility_id = f.id AND direction = 'incoming' AND status = 'fulfilled'), 0) AS consumable_revenue,
            (SELECT COUNT(*) FROM machines WHERE facility_id = f.id) AS machine_count,
            (SELECT COUNT(*) FROM action_items WHERE facility_id = f.id AND status = 'open') AS open_action_items,
            (SELECT COUNT(*) FROM action_items WHERE facility_id = f.id AND status = 'open' AND due_date < CURRENT_DATE) AS overdue_action_items,
            (SELECT COUNT(*) FROM communications WHERE facility_id = f.id AND created_at > NOW() - INTERVAL '30 days') AS recent_communications
          FROM facilities f
        `),
        client.query(`
          SELECT cs.facility_id, cs.quantity_on_hand, cs.reorder_threshold, p.reorder_lead_time_days,
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
          JOIN products p ON p.id = cs.product_id
        `),
        client.query(`
          SELECT
            (SELECT COALESCE(SUM(total_value), 0) FROM purchase_orders WHERE direction = 'incoming' AND status = 'fulfilled' AND updated_at >= DATE_TRUNC('month', NOW())) AS revenue_this_month,
            (SELECT COALESCE(SUM(total_value), 0) FROM purchase_orders WHERE direction = 'incoming' AND status = 'fulfilled' AND updated_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') AND updated_at < DATE_TRUNC('month', NOW())) AS revenue_last_month,
            (SELECT COUNT(*) FROM action_items WHERE created_at >= NOW() - INTERVAL '7 days') AS items_this_week,
            (SELECT COUNT(*) FROM action_items WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') AS items_last_week,
            (SELECT COUNT(*) FROM communications WHERE created_at >= NOW() - INTERVAL '7 days') AS comms_this_week,
            (SELECT COUNT(*) FROM communications WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') AS comms_last_week
        `),
        client.query(`
          SELECT DATE_TRUNC('month', updated_at) AS month, COALESCE(SUM(total_value), 0) AS revenue
          FROM purchase_orders
          WHERE direction = 'incoming' AND status = 'fulfilled' AND updated_at > NOW() - INTERVAL '12 months'
          GROUP BY 1
          ORDER BY 1 ASC
        `),
        client.query(`
          SELECT status, COUNT(*) AS count, COALESCE(SUM(quote_value), 0) AS value
          FROM projects
          GROUP BY status
        `),
        client.query(`SELECT status, COUNT(*) AS count FROM machines GROUP BY status`),
        client.query(`SELECT direction, status, COUNT(*) AS count FROM purchase_orders GROUP BY direction, status`),
        client.query(`
          SELECT p.id, p.name, p.unit,
            COALESCE((
              SELECT SUM(m.tank_capacity * 0.10 * m.fill_frequency_per_week)
              FROM machines m
              WHERE m.default_product_id = p.id AND m.status IN ('active', 'needs_service')
                AND m.tank_capacity IS NOT NULL AND m.fill_frequency_per_week IS NOT NULL
            ), 0) AS planned_weekly_volume,
            COALESCE((
              SELECT SUM(-quantity) FROM consumption_logs
              WHERE product_id = p.id AND type = 'usage' AND logged_at > NOW() - INTERVAL '7 days'
            ), 0) AS actual_weekly_volume
          FROM products p
        `),
        client.query(`SELECT stage, COUNT(*) AS count FROM machine_sourcing_orders GROUP BY stage`),
        client.query(`
          SELECT so.*, f.name AS facility_name
          FROM machine_sourcing_orders so
          LEFT JOIN facilities f ON f.id = so.facility_id
          WHERE so.stage NOT IN ('arrived', 'installed')
            AND so.expected_arrival_date IS NOT NULL AND so.expected_arrival_date >= CURRENT_DATE
            AND so.expected_arrival_date < CURRENT_DATE + INTERVAL '21 days'
          ORDER BY so.expected_arrival_date ASC
          LIMIT 8
        `),
      ])

      // Fold stock-flag risk into the leaderboard/at-risk view (same logic as the dashboard's needs-reorder calc).
      const flagsByFacility = {}
      for (const s of stock.rows) {
        const { flagged } = computeStockForecast({
          quantityOnHand: s.quantity_on_hand,
          reorderThreshold: s.reorder_threshold,
          usageLast60Days: s.usage_last_60_days,
          reorderLeadTimeDays: s.reorder_lead_time_days,
          plannedWeeklyUsage: s.planned_weekly_usage,
        })
        if (flagged) flagsByFacility[s.facility_id] = (flagsByFacility[s.facility_id] || 0) + 1
      }

      const facilityLeaderboard = leaderboard.rows
        .map((f) => {
          const lowStockFlags = flagsByFacility[f.id] || 0
          const totalValue = Number(f.pipeline_value) + Number(f.consumable_revenue)
          const riskScore = Number(f.overdue_action_items) * 2 + lowStockFlags * 3
          return { ...f, low_stock_flags: lowStockFlags, total_value: totalValue, risk_score: riskScore }
        })
        .sort((a, b) => b.total_value - a.total_value)

      const atRiskFacilities = [...facilityLeaderboard]
        .filter((f) => f.risk_score > 0)
        .sort((a, b) => b.risk_score - a.risk_score)
        .slice(0, 5)

      const pipelineMap = Object.fromEntries(pipelineByStage.rows.map((r) => [r.status, r]))
      const pipelineOrdered = PROJECT_STATUSES.map((status) => ({
        status,
        count: Number(pipelineMap[status]?.count || 0),
        value: Number(pipelineMap[status]?.value || 0),
      }))

      // Planned draw (from installed machines' tank size × fill cadence) vs. what's
      // actually been logged in the last 7 days — surfaces demand from machines that
      // haven't built up usage history yet, and flags products drifting from plan.
      const fleetDemandForecast = fleetDemand.rows
        .map((p) => ({
          ...p,
          planned_weekly_volume: Number(p.planned_weekly_volume),
          actual_weekly_volume: Number(p.actual_weekly_volume),
        }))
        .filter((p) => p.planned_weekly_volume > 0 || p.actual_weekly_volume > 0)
        .sort((a, b) => b.planned_weekly_volume - a.planned_weekly_volume)

      const sourcingMap = Object.fromEntries(sourcingStage.rows.map((r) => [r.stage, Number(r.count)]))
      const sourcingStageOrdered = SOURCING_STAGES.map((stage) => ({ stage, count: sourcingMap[stage] || 0 }))

      return {
        facility_leaderboard: facilityLeaderboard,
        at_risk_facilities: atRiskFacilities,
        deltas: deltas.rows[0],
        revenue_trend: revenueTrend.rows,
        pipeline_by_stage: pipelineOrdered,
        machine_status_breakdown: machineStatus.rows,
        po_status_breakdown: poStatus.rows,
        fleet_demand_forecast: fleetDemandForecast,
        sourcing_stage_breakdown: sourcingStageOrdered,
        arriving_soon: arrivingSoon.rows,
      }
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to load insights:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
