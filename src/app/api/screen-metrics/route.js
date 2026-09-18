import { NextResponse } from 'next/server'
import { withClient } from '@/lib/db'
import { requireSession } from '@/lib/session'
import { computeStockForecast } from '@/lib/consumption'

// Per-screen KPI strips. Each screen resolves to one round trip: a single
// aggregate query (plus the stock query where a reorder forecast is needed,
// since that calc lives in JS and is shared with the dashboard and insights).
//
// Metrics come back pre-shaped — { label, value, format, tone, hint } — so the
// MetricStrip component stays dumb and every screen renders the same way.

const STOCK_QUERY = `
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
`

async function flaggedStock(client, facilityId = null) {
  const query = facilityId ? `${STOCK_QUERY} WHERE cs.facility_id = $1` : STOCK_QUERY
  const result = await client.query(query, facilityId ? [facilityId] : [])
  const flaggedFacilities = new Set()
  let flaggedCount = 0
  for (const row of result.rows) {
    const { flagged } = computeStockForecast({
      quantityOnHand: row.quantity_on_hand,
      reorderThreshold: row.reorder_threshold,
      usageLast60Days: row.usage_last_60_days,
      reorderLeadTimeDays: row.reorder_lead_time_days,
      plannedWeeklyUsage: row.planned_weekly_usage,
    })
    if (flagged) {
      flaggedCount++
      flaggedFacilities.add(row.facility_id)
    }
  }
  return { flaggedCount, flaggedFacilityCount: flaggedFacilities.size }
}

const num = (v) => Number(v ?? 0)

const SCREENS = {
  facilities: async (client) => {
    const [stats, stock] = await Promise.all([
      client.query(`
        SELECT
          (SELECT COUNT(*) FROM facilities) AS facility_count,
          (SELECT COUNT(*) FROM projects WHERE status <> 'complete') AS active_projects,
          (SELECT COUNT(*) FROM action_items WHERE status = 'open') AS open_items,
          (SELECT COUNT(*) FROM machines WHERE status <> 'decommissioned') AS machines
      `),
      flaggedStock(client),
    ])
    const s = stats.rows[0]
    return [
      { label: 'Facilities', value: num(s.facility_count) },
      { label: 'Machines installed', value: num(s.machines) },
      { label: 'Active projects', value: num(s.active_projects) },
      { label: 'Open action items', value: num(s.open_items) },
      {
        label: 'Sites low on stock',
        value: stock.flaggedFacilityCount,
        tone: stock.flaggedFacilityCount > 0 ? 'warning' : 'default',
      },
    ]
  },

  machines: async (client) => {
    const result = await client.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'needs_service') AS needs_service,
        COUNT(*) FILTER (WHERE status = 'offline') AS offline,
        COALESCE(SUM(tank_capacity * 0.10 * fill_frequency_per_week)
          FILTER (WHERE status IN ('active', 'needs_service')), 0) AS planned_weekly_draw
      FROM machines
      WHERE status <> 'decommissioned'
    `)
    const m = result.rows[0]
    return [
      { label: 'Installed units', value: num(m.total) },
      { label: 'Active', value: num(m.active), tone: 'success' },
      { label: 'Needs service', value: num(m.needs_service), tone: num(m.needs_service) > 0 ? 'warning' : 'default' },
      { label: 'Offline', value: num(m.offline), tone: num(m.offline) > 0 ? 'danger' : 'default' },
      {
        label: 'Planned detergent draw',
        value: num(m.planned_weekly_draw),
        format: 'volume',
        hint: 'per week, from tank size × fill cadence',
      },
    ]
  },

  orders: async (client) => {
    const result = await client.query(`
      SELECT
        COALESCE(SUM(total_value) FILTER (WHERE status NOT IN ('cancelled', 'fulfilled')), 0) AS open_value,
        COUNT(*) FILTER (WHERE status IN ('submitted', 'confirmed')) AS awaiting,
        COALESCE(SUM(total_value) FILTER (WHERE status = 'fulfilled' AND updated_at >= DATE_TRUNC('month', NOW())), 0) AS fulfilled_this_month,
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled', 'fulfilled') AND expected_date IS NOT NULL AND expected_date < CURRENT_DATE) AS past_due
      FROM purchase_orders
    `)
    const o = result.rows[0]
    return [
      { label: 'Open order value', value: num(o.open_value), format: 'currency' },
      { label: 'Awaiting action', value: num(o.awaiting), tone: num(o.awaiting) > 0 ? 'warning' : 'default' },
      { label: 'Fulfilled this month', value: num(o.fulfilled_this_month), format: 'currency', tone: 'success' },
      { label: 'Past expected date', value: num(o.past_due), tone: num(o.past_due) > 0 ? 'danger' : 'default' },
    ]
  },

  sourcing: async (client) => {
    const result = await client.query(`
      SELECT
        COALESCE(SUM(quantity) FILTER (WHERE stage NOT IN ('arrived', 'installed')), 0) AS units_on_order,
        COUNT(*) FILTER (WHERE stage IN ('shipped', 'in_transit', 'customs')) AS in_transit,
        COUNT(*) FILTER (WHERE stage NOT IN ('arrived', 'installed') AND expected_arrival_date IS NOT NULL
          AND expected_arrival_date >= CURRENT_DATE AND expected_arrival_date < CURRENT_DATE + INTERVAL '30 days') AS arriving_30d,
        COALESCE(SUM(total_cost) FILTER (WHERE stage NOT IN ('arrived', 'installed')), 0) AS capital_committed,
        COUNT(*) FILTER (WHERE stage NOT IN ('arrived', 'installed') AND expected_arrival_date IS NOT NULL
          AND expected_arrival_date < CURRENT_DATE) AS overdue
      FROM machine_sourcing_orders
    `)
    const s = result.rows[0]
    return [
      { label: 'Units on order', value: num(s.units_on_order) },
      { label: 'In transit', value: num(s.in_transit) },
      { label: 'Arriving in 30 days', value: num(s.arriving_30d) },
      { label: 'Capital committed', value: num(s.capital_committed), format: 'currency' },
      { label: 'Past ETA', value: num(s.overdue), tone: num(s.overdue) > 0 ? 'danger' : 'default' },
    ]
  },

  tasks: async (client) => {
    const result = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open') AS open,
        COUNT(*) FILTER (WHERE status = 'open' AND due_date IS NOT NULL AND due_date < CURRENT_DATE) AS overdue,
        COUNT(*) FILTER (WHERE status = 'open' AND due_date IS NOT NULL
          AND due_date >= CURRENT_DATE AND due_date < CURRENT_DATE + INTERVAL '7 days') AS due_this_week,
        COUNT(*) FILTER (WHERE status = 'done' AND created_at >= NOW() - INTERVAL '7 days') AS closed_this_week
      FROM action_items
    `)
    const t = result.rows[0]
    return [
      { label: 'Open', value: num(t.open) },
      { label: 'Overdue', value: num(t.overdue), tone: num(t.overdue) > 0 ? 'danger' : 'default' },
      { label: 'Due this week', value: num(t.due_this_week), tone: num(t.due_this_week) > 0 ? 'warning' : 'default' },
      { label: 'Closed this week', value: num(t.closed_this_week), tone: 'success' },
    ]
  },

  communications: async (client) => {
    const result = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM communications) AS total,
        (SELECT COUNT(*) FROM communications WHERE created_at >= NOW() - INTERVAL '7 days') AS last_7,
        (SELECT COUNT(*) FROM communications WHERE created_at >= NOW() - INTERVAL '30 days') AS last_30,
        (SELECT COUNT(*) FROM action_items WHERE communication_id IS NOT NULL) AS extracted_items
    `)
    const c = result.rows[0]
    return [
      { label: 'Logged', value: num(c.total) },
      { label: 'Last 7 days', value: num(c.last_7) },
      { label: 'Last 30 days', value: num(c.last_30) },
      { label: 'Action items extracted', value: num(c.extracted_items), hint: 'pulled out of uploads by AI' },
    ]
  },

  products: async (client) => {
    const [stats, stock] = await Promise.all([
      client.query(`
        SELECT
          (SELECT COUNT(*) FROM products) AS skus,
          (SELECT COUNT(*) FROM consumable_stock) AS tracked,
          (SELECT COALESCE(ROUND(AVG(reorder_lead_time_days)), 0) FROM products) AS avg_lead_time
      `),
      flaggedStock(client),
    ])
    const p = stats.rows[0]
    return [
      { label: 'SKUs', value: num(p.skus) },
      { label: 'Stock records', value: num(p.tracked), hint: 'facility + product pairs tracked' },
      { label: 'Need reorder', value: stock.flaggedCount, tone: stock.flaggedCount > 0 ? 'warning' : 'default' },
      { label: 'Avg lead time', value: num(p.avg_lead_time), format: 'days' },
    ]
  },

  'machine-models': async (client) => {
    const result = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM machine_models) AS models,
        (SELECT COUNT(*) FROM machines WHERE machine_model_id IS NOT NULL) AS units_mapped,
        (SELECT COUNT(*) FROM machines WHERE machine_model_id IS NULL AND status <> 'decommissioned') AS units_unmapped,
        (SELECT COALESCE(MAX(tank_capacity), 0) FROM machine_models) AS largest_tank
    `)
    const m = result.rows[0]
    return [
      { label: 'Models', value: num(m.models) },
      { label: 'Units on a model', value: num(m.units_mapped) },
      {
        label: 'Units without a model',
        value: num(m.units_unmapped),
        tone: num(m.units_unmapped) > 0 ? 'warning' : 'default',
        hint: 'these fall out of demand planning',
      },
      { label: 'Largest tank', value: num(m.largest_tank), format: 'volume' },
    ]
  },

  facility: async (client, facilityId) => {
    const [stats, stock] = await Promise.all([
      client.query(`
        SELECT
          (SELECT COUNT(*) FROM machines WHERE facility_id = $1 AND status <> 'decommissioned') AS machines,
          (SELECT COUNT(*) FROM action_items WHERE facility_id = $1 AND status = 'open') AS open_items,
          (SELECT COUNT(*) FROM action_items WHERE facility_id = $1 AND status = 'open'
             AND due_date IS NOT NULL AND due_date < CURRENT_DATE) AS overdue_items,
          (SELECT COALESCE(SUM(quote_value), 0) FROM projects WHERE facility_id = $1 AND status <> 'complete') AS pipeline_value,
          (SELECT COUNT(*) FROM machine_sourcing_orders WHERE facility_id = $1 AND stage NOT IN ('arrived', 'installed')) AS inbound
      `, [facilityId]),
      flaggedStock(client, facilityId),
    ])
    const f = stats.rows[0]
    return [
      { label: 'Machines on site', value: num(f.machines) },
      { label: 'Open pipeline', value: num(f.pipeline_value), format: 'currency' },
      { label: 'Open items', value: num(f.open_items) },
      { label: 'Overdue', value: num(f.overdue_items), tone: num(f.overdue_items) > 0 ? 'danger' : 'default' },
      { label: 'Low on stock', value: stock.flaggedCount, tone: stock.flaggedCount > 0 ? 'warning' : 'default' },
      { label: 'Machines inbound', value: num(f.inbound) },
    ]
  },
}

export async function GET(request) {
  const { unauthorized } = await requireSession()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const screen = searchParams.get('screen')
  const facilityId = searchParams.get('facility_id')

  const resolver = SCREENS[screen]
  if (!resolver) {
    return NextResponse.json({ error: 'Unknown screen' }, { status: 400 })
  }
  if (screen === 'facility' && !facilityId) {
    return NextResponse.json({ error: 'facility_id is required' }, { status: 400 })
  }

  try {
    const metrics = await withClient((client) => resolver(client, facilityId))
    return NextResponse.json({ metrics })
  } catch (error) {
    console.error(`Failed to load ${screen} metrics:`, error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
