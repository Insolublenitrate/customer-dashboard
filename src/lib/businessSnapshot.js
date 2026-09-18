import { computeStockForecast, theoreticalWeeklyUsage } from './consumption'

// Builds the compact picture of the account that the AI advisor reasons over.
// Deliberately pre-computes the derived numbers (days of stock left, planned
// draw, days since last contact) rather than handing over raw rows: the model
// is being asked to spot patterns and opportunities, not to redo arithmetic
// the app already does correctly elsewhere.
export async function buildBusinessSnapshot(client) {
  const [facilities, machines, stock, projects, orders, sourcing, comms, actionItems, products] = await Promise.all([
    client.query('SELECT id, name, is_mother_location, city, state, region, regulatory_notes FROM facilities ORDER BY id'),
    client.query(`
      SELECT m.id, m.facility_id, m.model, m.status, m.tank_capacity, m.fill_frequency_per_week,
             m.install_date, mm.name AS machine_model_name, p.name AS default_product_name
      FROM machines m
      LEFT JOIN machine_models mm ON mm.id = m.machine_model_id
      LEFT JOIN products p ON p.id = m.default_product_id
    `),
    client.query(`
      SELECT cs.facility_id, cs.product_id, cs.quantity_on_hand, cs.reorder_threshold, cs.unit,
        p.name AS product_name, p.reorder_lead_time_days, p.unit_price,
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
    client.query('SELECT id, facility_id, title, status, quote_value, target_date, created_at, updated_at FROM projects'),
    client.query(`
      SELECT id, facility_id, direction, status, total_value, expected_date, supplier_name, updated_at
      FROM purchase_orders
    `),
    client.query(`
      SELECT id, facility_id, supplier_name, supplier_country, quantity, stage, total_cost,
             expected_arrival_date, actual_arrival_date, order_date
      FROM machine_sourcing_orders
    `),
    client.query(`
      SELECT facility_id, type, occurred_at, created_at, ai_summary
      FROM communications
      ORDER BY COALESCE(occurred_at, created_at) DESC
    `),
    client.query('SELECT id, facility_id, description, status, due_date, owner, created_at FROM action_items'),
    client.query('SELECT id, name, unit, unit_price, supplier_name, reorder_lead_time_days FROM products'),
  ])

  const daysSince = (date) => (date ? Math.round((Date.now() - new Date(date).getTime()) / 86400000) : null)
  const today = new Date().setHours(0, 0, 0, 0)

  const byFacility = facilities.rows.map((facility) => {
    const fMachines = machines.rows.filter((m) => m.facility_id === facility.id)
    const fProjects = projects.rows.filter((p) => p.facility_id === facility.id)
    const fOrders = orders.rows.filter((o) => o.facility_id === facility.id)
    const fComms = comms.rows.filter((c) => c.facility_id === facility.id)
    const fItems = actionItems.rows.filter((a) => a.facility_id === facility.id)
    const fSourcing = sourcing.rows.filter((s) => s.facility_id === facility.id)

    const fStock = stock.rows
      .filter((s) => s.facility_id === facility.id)
      .map((s) => {
        const forecast = computeStockForecast({
          quantityOnHand: s.quantity_on_hand,
          reorderThreshold: s.reorder_threshold,
          usageLast60Days: s.usage_last_60_days,
          reorderLeadTimeDays: s.reorder_lead_time_days,
          plannedWeeklyUsage: s.planned_weekly_usage,
        })
        return {
          product: s.product_name,
          on_hand: Number(s.quantity_on_hand),
          unit: s.unit,
          days_left: forecast.days_left,
          forecast_basis: forecast.forecast_source,
          needs_reorder: forecast.flagged,
          logged_usage_last_60_days: Number(s.usage_last_60_days),
          planned_weekly_draw: Number(s.planned_weekly_usage),
        }
      })

    const lastComm = fComms[0]
    const fulfilledRevenue = fOrders
      .filter((o) => o.direction === 'incoming' && o.status === 'fulfilled')
      .reduce((sum, o) => sum + Number(o.total_value || 0), 0)

    return {
      facility_id: facility.id,
      name: facility.name,
      is_mother_location: facility.is_mother_location,
      location: [facility.city, facility.state].filter(Boolean).join(', ') || null,
      region: facility.region,
      regulatory_notes: facility.regulatory_notes,
      machines: fMachines.map((m) => ({
        model: m.machine_model_name || m.model,
        status: m.status,
        tank_capacity: m.tank_capacity ? Number(m.tank_capacity) : null,
        fills_per_week: m.fill_frequency_per_week ? Number(m.fill_frequency_per_week) : null,
        planned_weekly_detergent: theoreticalWeeklyUsage(m) || null,
        runs_on: m.default_product_name,
        installed_days_ago: daysSince(m.install_date),
      })),
      consumable_stock: fStock,
      projects: fProjects.map((p) => ({
        title: p.title,
        status: p.status,
        quote_value: p.quote_value ? Number(p.quote_value) : null,
        target_date: p.target_date,
        days_since_update: daysSince(p.updated_at),
      })),
      consumable_revenue_to_date: fulfilledRevenue,
      open_order_value: fOrders
        .filter((o) => !['cancelled', 'fulfilled'].includes(o.status))
        .reduce((sum, o) => sum + Number(o.total_value || 0), 0),
      inbound_machines: fSourcing.map((s) => ({
        supplier: s.supplier_name,
        quantity: s.quantity,
        stage: s.stage,
        expected_arrival: s.expected_arrival_date,
        days_until_arrival: s.expected_arrival_date
          ? Math.round((new Date(s.expected_arrival_date).setHours(0, 0, 0, 0) - today) / 86400000)
          : null,
      })),
      open_action_items: fItems.filter((a) => a.status === 'open').length,
      overdue_action_items: fItems.filter(
        (a) => a.status === 'open' && a.due_date && new Date(a.due_date).setHours(0, 0, 0, 0) < today
      ).length,
      communications_last_90_days: fComms.filter((c) => daysSince(c.occurred_at || c.created_at) <= 90).length,
      days_since_last_contact: lastComm ? daysSince(lastComm.occurred_at || lastComm.created_at) : null,
      recent_discussion: fComms.slice(0, 3).map((c) => c.ai_summary).filter(Boolean),
    }
  })

  return {
    generated_at: new Date().toISOString(),
    account_totals: {
      facilities: facilities.rows.length,
      machines_installed: machines.rows.filter((m) => m.status !== 'decommissioned').length,
      open_pipeline_value: projects.rows
        .filter((p) => p.status !== 'complete')
        .reduce((sum, p) => sum + Number(p.quote_value || 0), 0),
      consumable_revenue_to_date: orders.rows
        .filter((o) => o.direction === 'incoming' && o.status === 'fulfilled')
        .reduce((sum, o) => sum + Number(o.total_value || 0), 0),
      machines_on_order: sourcing.rows
        .filter((s) => !['arrived', 'installed'].includes(s.stage))
        .reduce((sum, s) => sum + Number(s.quantity || 0), 0),
    },
    product_catalog: products.rows.map((p) => ({
      name: p.name,
      unit: p.unit,
      unit_price: p.unit_price ? Number(p.unit_price) : null,
      supplier: p.supplier_name,
      reorder_lead_time_days: p.reorder_lead_time_days,
    })),
    facilities: byFacility,
  }
}
