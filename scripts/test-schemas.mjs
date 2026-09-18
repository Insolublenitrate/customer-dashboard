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

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
