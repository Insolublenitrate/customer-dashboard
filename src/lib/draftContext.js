import { computeStockForecast } from './consumption'

// Gathers the facts behind a draft. Each kind pulls only what that message
// needs, so the model is never asked to pick the relevant detail out of the
// whole account.

export const DRAFT_KINDS = ['facility_checkin', 'supplier_chase', 'reorder_proposal', 'communication_reply']

async function facilityStock(client, facilityId) {
  const result = await client.query(
    `SELECT cs.quantity_on_hand, cs.reorder_threshold, cs.unit, p.name AS product_name,
       p.reorder_lead_time_days, p.unit_price,
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
     WHERE cs.facility_id = $1`,
    [facilityId]
  )

  return result.rows.map((row) => ({
    product: row.product_name,
    on_hand: `${Number(row.quantity_on_hand)} ${row.unit}`,
    unit_price: row.unit_price ? Number(row.unit_price) : null,
    reorder_lead_time_days: row.reorder_lead_time_days,
    planned_weekly_draw: Number(row.planned_weekly_usage),
    ...computeStockForecast({
      quantityOnHand: row.quantity_on_hand,
      reorderThreshold: row.reorder_threshold,
      usageLast60Days: row.usage_last_60_days,
      reorderLeadTimeDays: row.reorder_lead_time_days,
      plannedWeeklyUsage: row.planned_weekly_usage,
    }),
  }))
}

async function facilityBasics(client, facilityId) {
  const [facility, contacts, machines, items, lastComms, projects] = await Promise.all([
    client.query('SELECT id, name, city, state, regulatory_notes FROM facilities WHERE id = $1', [facilityId]),
    client.query('SELECT name, title, email, is_primary FROM contacts WHERE facility_id = $1 ORDER BY is_primary DESC', [facilityId]),
    client.query(
      `SELECT m.model, m.status, m.serial_number, m.install_date, mm.name AS machine_model_name
       FROM machines m LEFT JOIN machine_models mm ON mm.id = m.machine_model_id
       WHERE m.facility_id = $1`,
      [facilityId]
    ),
    client.query(
      `SELECT description, owner, due_date, status FROM action_items
       WHERE facility_id = $1 AND status = 'open' ORDER BY due_date NULLS LAST`,
      [facilityId]
    ),
    client.query(
      `SELECT type, occurred_at, created_at, ai_summary FROM communications
       WHERE facility_id = $1 ORDER BY COALESCE(occurred_at, created_at) DESC LIMIT 3`,
      [facilityId]
    ),
    client.query(
      `SELECT title, status, quote_value, target_date FROM projects
       WHERE facility_id = $1 AND status <> 'complete'`,
      [facilityId]
    ),
  ])

  if (facility.rows.length === 0) return null

  const last = lastComms.rows[0]
  const daysSince = (d) => (d ? Math.round((Date.now() - new Date(d).getTime()) / 86400000) : null)

  return {
    facility: facility.rows[0],
    contacts: contacts.rows,
    machines: machines.rows,
    open_action_items: items.rows,
    open_projects: projects.rows,
    recent_communications: lastComms.rows,
    days_since_last_contact: last ? daysSince(last.occurred_at || last.created_at) : null,
  }
}

export async function buildDraftContext(client, kind, contextId) {
  if (kind === 'facility_checkin') {
    const basics = await facilityBasics(client, contextId)
    if (!basics) return null
    return { ...basics, consumable_stock: await facilityStock(client, contextId) }
  }

  if (kind === 'reorder_proposal') {
    const basics = await facilityBasics(client, contextId)
    if (!basics) return null
    const stock = await facilityStock(client, contextId)
    return {
      facility: basics.facility,
      contacts: basics.contacts,
      machines: basics.machines,
      consumable_stock: stock,
      items_needing_reorder: stock.filter((s) => s.flagged),
    }
  }

  if (kind === 'supplier_chase') {
    const [order, events] = await Promise.all([
      client.query(
        `SELECT so.*, f.name AS destination_facility, mm.name AS machine_model_name
         FROM machine_sourcing_orders so
         LEFT JOIN facilities f ON f.id = so.facility_id
         LEFT JOIN machine_models mm ON mm.id = so.machine_model_id
         WHERE so.id = $1`,
        [contextId]
      ),
      client.query(
        'SELECT stage, occurred_at, notes FROM sourcing_order_events WHERE sourcing_order_id = $1 ORDER BY occurred_at ASC',
        [contextId]
      ),
    ])
    if (order.rows.length === 0) return null

    const row = order.rows[0]
    const daysLate = row.expected_arrival_date
      ? Math.round((Date.now() - new Date(row.expected_arrival_date).getTime()) / 86400000)
      : null

    return {
      sourcing_order: row,
      stage_history: events.rows,
      days_past_expected_arrival: daysLate && daysLate > 0 ? daysLate : null,
    }
  }

  if (kind === 'communication_reply') {
    const result = await client.query(
      `SELECT c.*, f.name AS facility_name FROM communications c
       LEFT JOIN facilities f ON f.id = c.facility_id WHERE c.id = $1`,
      [contextId]
    )
    if (result.rows.length === 0) return null
    const comm = result.rows[0]

    const related = comm.facility_id
      ? await client.query(
          `SELECT description, owner, due_date FROM action_items
           WHERE facility_id = $1 AND status = 'open'`,
          [comm.facility_id]
        )
      : { rows: [] }

    return {
      communication: {
        type: comm.type,
        occurred_at: comm.occurred_at || comm.created_at,
        facility: comm.facility_name,
        summary: comm.ai_summary,
        // Enough of the original to reply to specifics, not the whole transcript.
        excerpt: comm.raw_text ? comm.raw_text.slice(0, 4000) : null,
      },
      open_action_items_at_facility: related.rows,
      contacts: comm.facility_id
        ? (await client.query('SELECT name, title, email, is_primary FROM contacts WHERE facility_id = $1', [comm.facility_id])).rows
        : [],
    }
  }

  return null
}
