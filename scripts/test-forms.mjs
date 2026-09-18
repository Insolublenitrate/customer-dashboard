// Exercises the create forms in a real browser: what a rejected field says,
// what actually reaches the network, and what happens when the server says no.
// A build passing tells you none of that.
//
//   1. npm run dev            (DEMO_MODE=true in .env bypasses the session check)
//   2. node scripts/test-forms.mjs
//
// Every API call is stubbed by route interception, so no database is needed —
// which is the point: this checks the client, not the SQL.
//
// Needs playwright. Set PLAYWRIGHT_PACKAGE to an absolute path if it is
// installed globally rather than in this project.
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE || 'playwright'
const pw = await import(playwrightPath)
const { chromium } = pw.default ?? pw

const B = process.env.BASE_URL || 'http://localhost:3000'
const results = []
const ok = (n, c, d = '') => results.push({ n, pass: !!c, d })
const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })

// ============================== create modals ==============================
{
  const browser = await launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })

  const posted = []
  // Stub every API so nothing needs the (unreachable) production DB.
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = req.url()
    if (req.method() === 'POST' || req.method() === 'PUT') {
      let body = null
      try { body = JSON.parse(req.postData() || '{}') } catch {}
      posted.push({ url, body })
      // Reply the way the real route would, so the client path runs to the end.
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    }
    const empty = {
      facilities: [{ id: 1, name: 'Plant A' }],
      products: [{ id: 7, name: 'UltraClean 40' }],
      machine_models: [{ id: 3, name: 'US-1200XL', tank_capacity: 1200, fill_frequency_per_week: 4 }],
      machines: [], projects: [], sourcing_orders: [], purchase_orders: [],
      metrics: [], contacts: [], stock: [], consumption_logs: [], action_items: [],
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(empty) })
  })

  const errText = async () => (await page.locator('.field-error').allTextContents())

  // ---------- 1. machine-models: empty submit must block and name both fields ----------
  await page.goto(`${B}/machine-models`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: /Add model/i }).first().click()
  await page.waitForTimeout(300)
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(400)
  let errs = await errText()
  ok('empty submit is blocked (no POST sent)', posted.length === 0, `posted=${posted.length}`)
  ok('name error shown', errs.some((e) => /Model name is required/.test(e)), errs.join(' | '))
  ok('tank capacity error shown', errs.some((e) => /Tank capacity must be a number/.test(e)), errs.join(' | '))
  ok('invalid field gets red border', await page.locator('.input.input-invalid').count() >= 2)

  // ---------- 2. non-numeric capacity is rejected, not silently NULLed ----------
  await page.locator('input[name=name]').fill('US-900')
  await page.locator('input[name=tank_capacity]').fill('')
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(400)
  errs = await errText()
  ok('blank capacity still blocks', posted.length === 0 && errs.some((e) => /Tank capacity/.test(e)), errs.join(' | '))

  // ---------- 3. valid submit POSTs coerced types ----------
  await page.locator('input[name=tank_capacity]').fill('1200')
  await page.locator('input[name=fill_frequency_per_week]').fill('4')
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(600)
  const mm = posted.find((p) => p.url.includes('machine-models'))
  ok('valid submit POSTs', !!mm, JSON.stringify(posted))
  ok('capacity sent as number 1200, not "1200"', mm && mm.body.tank_capacity === 1200, JSON.stringify(mm?.body))
  ok('blank notes sent as null, not ""', mm && mm.body.notes === null, JSON.stringify(mm?.body))
  ok('modal closed after success', await page.locator('.modal-backdrop').count() === 0)

  // ---------- 4. machines: model select prefills capacity (setValue path) ----------
  posted.length = 0
  await page.goto(`${B}/machines`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /Add machine/i }).first().click()
  await page.waitForTimeout(300)
  await page.locator('select[name=machine_model_id]').selectOption('3')
  await page.waitForTimeout(300)
  ok('picking a model prefills tank capacity', await page.locator('input[name=tank_capacity]').inputValue() === '1200')
  ok('picking a model prefills fills/week', await page.locator('input[name=fill_frequency_per_week]').inputValue() === '4')
  const preview = await page.locator('.modal-panel p.text-muted').filter({ hasText: /detergent per fill/ }).count()
  ok('10% preview renders from useWatch', preview === 1)
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(400)
  ok('machine without facility is blocked', posted.length === 0 && (await errText()).some((e) => /Facility is required/.test(e)), (await errText()).join(' | '))

  // ---------- 5. orders: direction toggle swaps which field is required ----------
  posted.length = 0
  await page.goto(`${B}/orders`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /New order/i }).first().click()
  await page.waitForTimeout(300)
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(400)
  ok('incoming order needs a facility', (await errText()).some((e) => /Pick the facility/.test(e)), (await errText()).join(' | '))
  await page.locator('form').getByRole('button', { name: 'From supplier' }).click()
  await page.waitForTimeout(300)
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(400)
  ok('outgoing order needs a supplier instead', (await errText()).some((e) => /Name the supplier/.test(e)), (await errText()).join(' | '))
  await page.locator('input[name=supplier_name]').fill('Acme Ultrasonics')
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(600)
  const po = posted.find((p) => p.url.includes('purchase-orders'))
  ok('outgoing order POSTs', !!po, JSON.stringify(posted))
  ok('blank line rows are dropped', po && Array.isArray(po.body.items) && po.body.items.length === 0, JSON.stringify(po?.body.items))

  // ---------- 6. server-side 400 lands on the named field ----------
  posted.length = 0
  await page.unroute('**/api/**')
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      return route.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ error: 'Facility name is required', field: 'name', issues: [] }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"facilities":[],"metrics":[]}' })
  })
  await page.goto(`${B}/facilities`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /Add facility/i }).first().click()
  await page.waitForTimeout(300)
  await page.locator('input[name=name]').fill('Plant B')
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(700)
  errs = await errText()
  ok("server's 400 renders on its field", errs.some((e) => /Facility name is required/.test(e)), errs.join(' | '))
  ok('modal stays open on server rejection', await page.locator('.modal-backdrop').count() === 1)

  // ---------- 7. no horizontal scroll anywhere (the standing rule) ----------
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  ok('no horizontal page scroll at 390px', !overflow)
  await browser.close()
}

// =========================== facility detail page ==========================
{
  const browser = await launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const posted = []
  let rejectNext = false

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      let body = null
      try { body = JSON.parse(req.postData() || '{}') } catch {}
      posted.push({ url: req.url(), body })
      if (rejectNext) {
        return route.fulfill({ status: 400, contentType: 'application/json',
          body: JSON.stringify({ error: 'Contact name is required', field: 'name' }) })
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      facility: { id: 1, name: 'Plant A', city: 'Toledo', state: 'OH', status: 'active' },
      contacts: [], projects: [], communications: [], action_items: [],
      machines: [], products: [{ id: 7, name: 'UltraClean 40' }],
      machine_models: [{ id: 3, name: 'US-1200XL', tank_capacity: 1200, fill_frequency_per_week: 4 }],
      stock: [], consumption_logs: [], metrics: [],
    }) })
  })

  const errText = async () => (await page.locator('.field-error').allTextContents())
  await page.goto(`${B}/facilities/1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // --- machine form: model prefill + validation ---
  await page.locator('form').count()
  const openers = page.locator('.glass-card button.btn-secondary')
  ok('facility page rendered', await page.getByRole('heading', { name: 'Plant A' }).count() > 0)

  // open "Machines at this site" form
  await page.locator('.glass-card', { hasText: 'Machines at this site' }).locator('button.btn-secondary').first().click()
  await page.waitForTimeout(400)
  await page.locator('select[name=machine_model_id]').selectOption('3')
  await page.waitForTimeout(300)
  ok('machine model prefills capacity here too', await page.locator('input[name=tank_capacity]').inputValue() === '1200')
  await page.locator('form').filter({ hasText: 'Add machine' }).locator('button[type=submit]').click()
  await page.waitForTimeout(700)
  const mach = posted.find((p) => p.url.includes('/api/machines'))
  ok('machine POSTs with facility_id from the route', mach && String(mach.body.facility_id) === '1', JSON.stringify(mach?.body))
  ok('capacity coerced to number', mach && mach.body.tank_capacity === 1200, JSON.stringify(mach?.body))

  // --- log form: required product + quantity ---
  posted.length = 0
  await page.locator('.glass-card', { hasText: 'Consumable stock' }).locator('button.btn-secondary').first().click()
  await page.waitForTimeout(400)
  await page.locator('form').filter({ hasText: 'Log entry' }).locator('button[type=submit]').click()
  await page.waitForTimeout(500)
  let errs = await errText()
  ok('empty log entry is blocked', posted.length === 0, `posted=${posted.length}`)
  ok('log names the missing product', errs.some((e) => /Product is required/.test(e)), errs.join(' | '))
  ok('log names the missing quantity', errs.some((e) => /Quantity must be a number/.test(e)), errs.join(' | '))

  // --- contact form: invalid email, then a server 400 keeps the form open ---
  posted.length = 0
  await page.locator('.glass-card', { hasText: 'Contacts' }).locator('button.btn-secondary').first().click()
  await page.waitForTimeout(400)
  const contactForm = page.locator('form').filter({ hasText: 'Add contact' })
  await contactForm.locator('input[name=name]').fill('Dana Reyes')
  await contactForm.locator('input[name=email]').fill('not-an-email')
  await contactForm.locator('button[type=submit]').click()
  await page.waitForTimeout(500)
  errs = await errText()
  ok('bad email is caught before the request', posted.length === 0 && errs.some((e) => /Not a valid email/.test(e)), errs.join(' | '))
  await contactForm.locator('input[name=email]').fill('dana@plant-a.example')
  rejectNext = true
  await contactForm.locator('button[type=submit]').click()
  await page.waitForTimeout(700)
  errs = await errText()
  ok("server rejection keeps the contact form open", await contactForm.count() === 1)
  ok("server's message appears on the field", errs.some((e) => /Contact name is required/.test(e)), errs.join(' | '))

  // --- and the previously-silent failure is gone: a rejected POST no longer closes the form ---
  ok('a rejected POST no longer closes the form silently', await contactForm.locator('input[name=name]').inputValue() === 'Dana Reyes')

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
  ok('no horizontal page scroll at 390px', !overflow)
  await browser.close()
}

// ======================== edit forms and PUT paths =========================
{
  const ORDER = {
    id: 2, project_id: null, facility_id: 1, machine_model_id: null, supplier_name: 'Acme Ultrasonics',
    supplier_country: 'DE', quantity: 2, stage: 'in_transit', order_date: '2026-05-02T00:00:00.000Z',
    deposit_amount: '9000.00', deposit_paid_date: '2026-05-09T00:00:00.000Z', total_cost: '45000.00',
    expected_ship_date: '2026-07-01T00:00:00.000Z', actual_ship_date: null,
    expected_arrival_date: '2026-08-20T00:00:00.000Z', actual_arrival_date: null,
    container_number: 'MSKU1234567', vessel_name: 'MV Rhine', carrier: 'Maersk',
    port_of_origin: 'Hamburg', port_of_destination: 'Norfolk', tracking_url: null, notes: null,
  }
  const PO = {
    id: 9, direction: 'incoming', facility_id: 1, facility_name: 'Plant A', supplier_name: null,
    status: 'confirmed', po_number: 'PO-1041', expected_date: '2026-10-01T00:00:00.000Z',
    total_value: '4820.50', notes: null, created_at: '2026-09-01T00:00:00.000Z',
    items: [{ id: 22, purchase_order_id: 9, product_id: 7, product_name: 'UltraClean 40', description: null, quantity: '12.00', unit_price: '401.71' }],
  }

  const browser = await launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const puts = []
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    if (req.method() === 'PUT') {
      let body = null
      try { body = JSON.parse(req.postData() || '{}') } catch {}
      puts.push({ url: req.url(), body })
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      sourcing_order: ORDER, events: [], machines: [], purchase_orders: [PO],
      facilities: [{ id: 1, name: 'Plant A' }], products: [{ id: 7, name: 'UltraClean 40' }],
      machine_models: [], sourcing_orders: [], projects: [], metrics: [],
    }) })
  })

  // A Postgres date column comes back as an ISO timestamp, which
  // <input type="date"> cannot display — every date read as unset.
  await page.goto(`${B}/sourcing/2`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.locator('button.btn-secondary').filter({ has: page.locator('svg.lucide-pencil') }).first().click()
  await page.waitForTimeout(600)
  const dateKeys = ['order_date', 'deposit_paid_date', 'expected_ship_date', 'actual_ship_date', 'expected_arrival_date', 'actual_arrival_date']
  const shown = {}
  for (const k of dateKeys) shown[k] = await page.locator('input[type=date]').nth(dateKeys.indexOf(k)).inputValue()
  ok('edit form shows the dates the order actually has', shown.order_date === '2026-05-02' && shown.expected_ship_date === '2026-07-01', JSON.stringify(shown))
  ok('an unset date stays empty', shown.actual_ship_date === '', JSON.stringify(shown))

  await page.locator('input[name=supplier_name]').fill('')
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(500)
  ok('clearing the supplier blocks the save', puts.length === 0 && (await page.locator('.field-error').allTextContents()).some((e) => /Supplier name is required/.test(e)))

  await page.locator('input[name=supplier_name]').fill('Acme Ultrasonics')
  await page.locator('form button[type=submit]').click()
  await page.waitForTimeout(700)
  const sPut = puts.find((p) => p.url.includes('sourcing-orders'))
  ok('saving PUTs the edited order', !!sPut)
  ok('dates go back as calendar dates, not timestamps', sPut && sPut.body.order_date === '2026-05-02', JSON.stringify(sPut?.body.order_date))
  ok('untouched columns ride along', sPut && sPut.body.stage === 'in_transit' && sPut.body.facility_id === 1,
    JSON.stringify({ stage: sPut?.body.stage, facility_id: sPut?.body.facility_id }))

  // The status controls PUT a whole database row back; the route has to accept
  // pg's own shapes (numerics as strings, dates as timestamps) rather than 400.
  puts.length = 0
  await page.goto(`${B}/orders`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const statusSelect = page.locator('select').filter({ has: page.locator('option[value=fulfilled]') }).first()
  await statusSelect.selectOption('shipped')
  await page.waitForTimeout(700)
  const poPut = puts.find((p) => p.url.includes('purchase-orders'))
  ok('a status change PUTs the order row', !!poPut)
  if (poPut) {
    const res = await page.request.fetch(`${B}/api/purchase-orders/9`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, data: poPut.body,
    })
    ok('the route accepts a real database row', res.status() !== 400, `${res.status()} ${(await res.text()).slice(0, 160)}`)
  }

  await browser.close()
}

let fail = 0
for (const r of results) {
  if (!r.pass) fail++
  console.log(`${r.pass ? 'ok  ' : 'FAIL'}  ${r.n}${r.pass ? '' : `   -> ${r.d}`}`)
}
console.log(`\n${results.length - fail} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
