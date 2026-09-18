const S = await import('../src/lib/schemas.js')
let pass = 0, fail = 0
const t = (label, fn) => { try { fn(); console.log('  ok   ', label); pass++ } catch (e) { console.log('  FAIL ', label, '->', e.message); fail++ } }
const eq = (a, b, m) => { const A=JSON.stringify(a), B=JSON.stringify(b); if (A !== B) throw new Error(`${m||''} got ${A} want ${B}`) }

console.log('\nMachineModelSchema')
t('valid form input coerces strings to numbers', () => {
  const r = S.MachineModelSchema.safeParse({ name: ' US-500 ', tank_capacity: '500', fill_frequency_per_week: '5', notes: '' })
  if (!r.success) throw new Error(JSON.stringify(r.error.issues))
  eq(r.data, { name: 'US-500', tank_capacity: 500, fill_frequency_per_week: 5, notes: null })
})
t('rejects non-numeric tank capacity (was silently NULL before)', () => {
  const r = S.MachineModelSchema.safeParse({ name: 'X', tank_capacity: 'abc' })
  if (r.success) throw new Error('should have failed')
  eq(S.validationError(r).field, 'tank_capacity')
})
t('rejects zero tank capacity', () => {
  const r = S.MachineModelSchema.safeParse({ name: 'X', tank_capacity: '0' })
  if (r.success) throw new Error('should have failed')
})
t('rejects blank name', () => {
  const r = S.MachineModelSchema.safeParse({ name: '   ', tank_capacity: '100' })
  if (r.success) throw new Error('should have failed')
  eq(S.validationError(r).field, 'name')
})

console.log('\nMachineSchema')
t('empty optional fields become null, not NaN', () => {
  const r = S.MachineSchema.safeParse({ facility_id: '3', machine_model_id: '', tank_capacity: '', fill_frequency_per_week: '', install_date: '', status: 'active' })
  if (!r.success) throw new Error(JSON.stringify(r.error.issues))
  eq([r.data.machine_model_id, r.data.tank_capacity, r.data.fill_frequency_per_week, r.data.install_date], [null, null, null, null])
})
t('invalid status falls back to active', () => {
  const r = S.MachineSchema.safeParse({ facility_id: '3', status: 'bogus' })
  eq(r.data.status, 'active')
})
t('rejects garbage date', () => {
  const r = S.MachineSchema.safeParse({ facility_id: '3', install_date: 'not-a-date' })
  if (r.success) throw new Error('should have failed')
  eq(S.validationError(r).field, 'install_date')
})
t('missing facility_id rejected', () => {
  const r = S.MachineSchema.safeParse({ serial_number: 'SN-1' })
  if (r.success) throw new Error('should have failed')
})

console.log('\nPurchaseOrderSchema (direction-conditional)')
t('incoming without facility is rejected', () => {
  const r = S.PurchaseOrderSchema.safeParse({ direction: 'incoming', facility_id: '' })
  if (r.success) throw new Error('should have failed')
  eq(S.validationError(r).field, 'facility_id')
})
t('outgoing without supplier is rejected', () => {
  const r = S.PurchaseOrderSchema.safeParse({ direction: 'outgoing', supplier_name: '' })
  if (r.success) throw new Error('should have failed')
  eq(S.validationError(r).field, 'supplier_name')
})
t('outgoing with supplier passes and defaults items', () => {
  const r = S.PurchaseOrderSchema.safeParse({ direction: 'outgoing', supplier_name: 'ChemSupply Co' })
  if (!r.success) throw new Error(JSON.stringify(r.error.issues))
  eq(r.data.items, [])
})
t('line items coerce', () => {
  const r = S.PurchaseOrderSchema.safeParse({ direction: 'outgoing', supplier_name: 'X', items: [{ product_id: '2', quantity: '3', unit_price: '310.50', description: '' }] })
  eq(r.data.items[0], { product_id: 2, description: null, quantity: 3, unit_price: 310.5 })
})

console.log('\nSourcingOrderSchema')
t('quantity defaults to 1, dates null', () => {
  const r = S.SourcingOrderSchema.safeParse({ supplier_name: 'Zhejiang', quantity: '', expected_arrival_date: '' })
  if (!r.success) throw new Error(JSON.stringify(r.error.issues))
  eq([r.data.quantity, r.data.expected_arrival_date], [1, null])
})
t('fractional quantity rejected', () => {
  const r = S.SourcingOrderSchema.safeParse({ supplier_name: 'X', quantity: '2.5' })
  if (r.success) throw new Error('should have failed')
})

console.log('\nContactSchema')
t('bad email rejected', () => {
  const r = S.ContactSchema.safeParse({ facility_id: '1', name: 'Dana', email: 'dana@' })
  if (r.success) throw new Error('should have failed')
  eq(S.validationError(r).field, 'email')
})
t('empty email allowed', () => {
  const r = S.ContactSchema.safeParse({ facility_id: '1', name: 'Dana', email: '' })
  if (!r.success) throw new Error(JSON.stringify(r.error.issues))
  eq(r.data.email, null)
})

console.log('\nProductSchema')
t('lead time defaults to 14 when blank', () => {
  const r = S.ProductSchema.safeParse({ name: 'UltraClean 40', reorder_lead_time_days: '', unit: '' })
  eq([r.data.reorder_lead_time_days, r.data.unit], [14, 'gallon'])
})

// ---------------------------------------------------------------------------
// The edit paths POST a row straight back from the database, not a form. pg
// hands back numerics as strings and dates as ISO timestamps, so these check
// that a real row survives the round trip instead of 400-ing the user out of
// a status change.

console.log('\nUpdate schemas against real Postgres row shapes')

t('machine row round-trips through MachineUpdateSchema', () => {
  const row = {
    id: 4, facility_id: 1, project_id: null, machine_model_id: 3, sourcing_order_id: null,
    serial_number: 'SN-0042', model: 'US-1200XL', install_date: '2026-03-14T00:00:00.000Z',
    status: 'needs_service', default_product_id: 7,
    tank_capacity: '1200.00', fill_frequency_per_week: '4.0', notes: null,
    created_at: '2026-03-01T12:00:00.000Z', facility_name: 'Plant A',
  }
  const r = S.MachineUpdateSchema.safeParse({ ...row, status: 'active' })
  if (!r.success) throw new Error(JSON.stringify(r.error.issues))
  eq([r.data.tank_capacity, r.data.fill_frequency_per_week, r.data.status], [1200, 4, 'active'])
})

t('purchase order row round-trips, items and all', () => {
  const row = {
    id: 9, direction: 'incoming', facility_id: 1, supplier_name: null, status: 'confirmed',
    po_number: 'PO-1041', expected_date: '2026-10-01T00:00:00.000Z', total_value: '4820.50',
    notes: null, items: [{ id: 22, purchase_order_id: 9, product_id: 7, description: null, quantity: '12.00', unit_price: '401.71' }],
  }
  const r = S.PurchaseOrderUpdateSchema.safeParse({ ...row, status: 'shipped' })
  if (!r.success) throw new Error(JSON.stringify(r.error.issues))
  eq([r.data.total_value, r.data.status, r.data.items[0].quantity, r.data.items[0].product_id], [4820.5, 'shipped', 12, 7])
})

t('sourcing order row round-trips with every date column set', () => {
  const row = {
    id: 2, project_id: null, facility_id: 1, machine_model_id: 3,
    supplier_name: 'Acme Ultrasonics', supplier_country: 'DE', quantity: 2, stage: 'in_transit',
    order_date: '2026-05-02T00:00:00.000Z', deposit_amount: '9000.00', deposit_paid_date: '2026-05-09T00:00:00.000Z',
    total_cost: '45000.00', expected_ship_date: '2026-07-01T00:00:00.000Z', actual_ship_date: '2026-07-04T00:00:00.000Z',
    expected_arrival_date: '2026-08-20T00:00:00.000Z', actual_arrival_date: null,
    container_number: 'MSKU1234567', vessel_name: 'MV Rhine', carrier: 'Maersk',
    port_of_origin: 'Hamburg', port_of_destination: 'Norfolk', tracking_url: null, notes: null,
  }
  const r = S.SourcingOrderSchema.safeParse({ ...row, stage: 'customs' })
  if (!r.success) throw new Error(JSON.stringify(r.error.issues))
  eq([r.data.quantity, r.data.total_cost, r.data.stage, r.data.actual_arrival_date], [2, 45000, 'customs', null])
})

t('project row round-trips through ProjectUpdateSchema', () => {
  const row = {
    id: 5, facility_id: 1, title: 'Line 3 ultrasonic cell', spec_summary: 'Two-stage',
    status: 'quoted', quote_value: '128000.00', target_date: '2026-11-15T00:00:00.000Z',
  }
  const r = S.ProjectUpdateSchema.safeParse({ ...row, status: 'approved' })
  if (!r.success) throw new Error(JSON.stringify(r.error.issues))
  eq([r.data.quote_value, r.data.status], [128000, 'approved'])
})

// Deliberate, and unchanged from what the routes did before: an unrecognised
// status becomes the default rather than a 400. Worth knowing, because it means
// a stale client silently resets the field instead of failing loudly.
t('an unknown status falls back rather than 400-ing a status change', () => {
  const r = S.ProjectUpdateSchema.safeParse({ title: 'T', status: 'not-a-status' })
  eq(r.data.status, 'discovery')
})

t('stock threshold rejects a blank threshold', () => {
  const r = S.StockThresholdSchema.safeParse({ product_id: '7', reorder_threshold: '' })
  if (r.success) throw new Error('should have failed')
  eq(S.validationError(r).field, 'reorder_threshold')
})

t('action item create demands a facility', () => {
  const r = S.ActionItemCreateSchema.safeParse({ description: 'Call Dana' })
  if (r.success) throw new Error('should have failed')
  eq(S.validationError(r).field, 'facility_id')
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
