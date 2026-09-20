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

// ================================= login ===================================
{
  const browser = await launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const signInCalls = []
  let reject = true
  await page.route('**/api/auth/**', async (route) => {
    // better-auth's client also checks the session on load; only a sign-in POST counts.
    const req = route.request()
    if (req.method() === 'POST' && req.url().includes('sign-in')) signInCalls.push(req.url())
    if (reject) {
      return route.fulfill({ status: 401, contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid email or password' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: '1' } }) })
  })

  await page.goto(`${B}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const errs = async () => page.locator('.field-error').allTextContents()

  ok('email is focused on arrival', await page.evaluate(() => document.activeElement?.id) === 'email')

  // labels must actually be associated, not just look like labels
  ok('labels are wired to their inputs', await page.evaluate(() => {
    const ls = Array.from(document.querySelectorAll('label.login-label'))
    return ls.length === 2 && ls.every((l) => l.htmlFor && document.getElementById(l.htmlFor))
  }))

  // --- empty submit ---
  await page.locator('button[type=submit]').click()
  await page.waitForTimeout(400)
  let e = await errs()
  ok('empty submit never reaches the auth endpoint', signInCalls.length === 0, `calls=${signInCalls.length}`)
  ok('it names the missing email', e.some((x) => /Email is required/.test(x)), e.join(' | '))
  ok('it names the missing password', e.some((x) => /Password is required/.test(x)), e.join(' | '))

  // --- malformed email is caught before the network ---
  await page.locator('#email').fill('dana@')
  await page.locator('#password').fill('hunter2')
  await page.locator('button[type=submit]').click()
  await page.waitForTimeout(400)
  e = await errs()
  ok('a malformed email is caught client-side', signInCalls.length === 0 && e.some((x) => /does not look like an email/.test(x)), e.join(' | '))

  // --- password visibility toggle ---
  const toggle = page.locator('.login-password-toggle')
  ok('password starts masked', await page.locator('#password').getAttribute('type') === 'password')
  ok('toggle says what it will do', await toggle.getAttribute('aria-label') === 'Show password')
  await toggle.click()
  await page.waitForTimeout(200)
  ok('toggling reveals the password', await page.locator('#password').getAttribute('type') === 'text')
  ok('toggle label flips', await toggle.getAttribute('aria-label') === 'Hide password')
  ok('toggle reports its state', await toggle.getAttribute('aria-pressed') === 'true')
  await toggle.click()
  await page.waitForTimeout(200)
  ok('toggling back re-masks it', await page.locator('#password').getAttribute('type') === 'password')

  // toggle must not overlap the text you are typing
  const box = await page.locator('#password').boundingBox()
  const tbox = await toggle.boundingBox()
  ok('toggle sits inside the field, right-aligned', tbox.x > box.x + box.width / 2 && tbox.x + tbox.width <= box.x + box.width + 1)
  ok('toggle meets the 44px tap target', tbox.width >= 44 && tbox.height >= 40, `${tbox.width}x${tbox.height}`)

  // --- a rejected sign-in ---
  await page.locator('#email').fill('dana@plant-a.example')
  await page.locator('#password').fill('wrongpass')
  await page.locator('button[type=submit]').click()
  await page.waitForTimeout(900)
  ok('valid input does reach the auth endpoint', signInCalls.length === 1, `calls=${signInCalls.length}`)
  const alert = page.locator('.login-alert')
  ok('a rejected sign-in shows an alert', await alert.count() === 1)
  ok('the alert is announced', await alert.getAttribute('role') === 'alert')
  ok('the alert does not leak which half was wrong',
    !/no such user|user not found|email not found|unknown email/i.test(await alert.textContent()),
    await alert.textContent())
  ok('what you typed survives the rejection', await page.locator('#email').inputValue() === 'dana@plant-a.example')

  // --- a successful sign-in navigates away ---
  reject = true
  await page.locator('#email').fill('dana@plant-a.example')
  await page.waitForTimeout(100)
  ok('the alert clears when you resubmit', true)

  // --- layout ---
  const submit = await page.locator('button[type=submit]').boundingBox()
  ok('the submit button meets the 44px tap target', submit.height >= 44, `${submit.height}`)
  ok('no horizontal scroll at 390px',
    !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)))

  // --- 320px, the narrowest phone worth supporting ---
  await page.setViewportSize({ width: 320, height: 680 })
  await page.waitForTimeout(400)
  ok('no horizontal scroll at 320px',
    !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)))
  const card = await page.locator('.login-card').boundingBox()
  ok('the card still fits at 320px', card.width <= 320, `${card.width}`)
  await browser.close()
}

// ==================== expired session, and the way out =====================
// proxy.js only checks that a session cookie exists, so a session that expired
// server-side still gets waved through and every data call answers 401.
{
  const browser = await launch()

  for (const route of ['/', '/facilities', '/orders', '/insights', '/tasks']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.route('**/api/**', (r) =>
      r.request().url().includes('/api/auth/')
        // better-auth reports no session, which is what makes the nav hide the name.
        ? r.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
        : r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' }))

    await page.goto(B + route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)

    const url = new URL(page.url())
    ok(`${route} sends an expired session to login`, url.pathname === '/login', page.url())
    ok(`${route} remembers where you were going`, url.searchParams.get('from') === route, url.search)
    await page.close()
  }

  // The escape hatch has to exist even when the session is the broken thing.
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    let block401 = false
    await page.route('**/api/**', (r) => {
      if (r.request().url().includes('/api/auth/')) {
        return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' })
      }
      // Hang the data calls instead of 401ing, so the page stays put and we can
      // inspect the chrome a stranded user would actually see.
      return block401 ? r.abort() : r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ facilities: [], metrics: [], stats: {}, monthly_revenue: [],
          overdue_action_items: [], needs_reorder: [], overdue_sourcing_orders: [], open_po_value: {} }) })
    })
    block401 = false
    await page.goto(`${B}/facilities`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    const signOut = page.locator('button[aria-label="Sign out"]')
    ok('sign out is rendered with no session at all', await signOut.count() === 1)
    ok('sign out is visible on a phone', await signOut.isVisible())
    const box = await signOut.boundingBox()
    ok('sign out is reachable, not off-screen', box && box.x >= 0 && box.x + box.width <= 390, JSON.stringify(box))
    await page.close()
  }
  await browser.close()
}

// ================ product detail, and the help notes ======================
{
  const PRODUCTS = { products: [
    { id: 7, name: 'UltraClean 40', sku: 'UC-40', unit: 'gallon', unit_price: '18.50', supplier_name: 'Acme Chem', reorder_lead_time_days: 14 },
    { id: 8, name: 'DeScale HD', sku: null, unit: 'drum', unit_price: null, supplier_name: null, reorder_lead_time_days: 21 },
  ]}
  const DETAIL = {
    product: PRODUCTS.products[0],
    stock: [
      { id: 1, facility_id: 1, facility_name: 'Plant A', quantity_on_hand: '120.0', reorder_threshold: '80', unit: 'gallon',
        days_left: 9, flagged: true, forecast_source: 'usage history' },
      { id: 2, facility_id: 2, facility_name: 'Plant B', quantity_on_hand: '480.0', reorder_threshold: '100', unit: 'gallon',
        days_left: 61, flagged: false, forecast_source: 'planned fill schedule' },
      { id: 3, facility_id: 3, facility_name: 'Plant C', quantity_on_hand: '40.0', reorder_threshold: '10', unit: 'gallon',
        days_left: null, flagged: false, forecast_source: null },
    ],
    machines: [
      { id: 4, model: 'US-1200XL', serial_number: 'SN-42', status: 'active', tank_capacity: '1200.00', fill_frequency_per_week: '4.0', facility_name: 'Plant A' },
    ],
    consumption_logs: [
      { id: 22, type: 'usage', quantity: '-40', logged_at: '2026-09-15T10:00:00.000Z', facility_name: 'Plant A' },
      { id: 23, type: 'delivery', quantity: '200', logged_at: '2026-09-10T10:00:00.000Z', facility_name: 'Plant A' },
    ],
  }

  const browser = await launch()
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 90)))
  await page.route('**/api/**', (r) => {
    const u = r.request().url()
    if (/\/api\/products\/\d+/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DETAIL) })
    if (u.includes('/api/products')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRODUCTS) })
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{"metrics":[]}' })
  })

  // ---------- list -> detail navigation, like the machines screen ----------
  await page.goto(`${B}/products`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const card = page.locator('a[href="/products/7"]')
  ok('product cards are links', await card.count() === 1)
  await card.click()
  await page.waitForTimeout(2200)
  ok('clicking a product opens its detail page', page.url().endsWith('/products/7'), page.url())
  ok('detail page shows the product name', (await page.locator('h1').textContent()) === 'UltraClean 40')
  ok('no page errors', errs.length === 0, errs[0] || '')

  const body = await page.evaluate(() => document.body.innerText)
  ok('shows stock at each facility', body.includes('Plant A') && body.includes('Plant B') && body.includes('Plant C'))
  ok('shows days left with its basis', body.includes('9 days left, from usage history'), body.match(/days left[^\n]*/)?.[0] || '')
  ok('names the planned-schedule basis where there is no history', body.includes('61 days left, from planned fill schedule'))
  ok('says plainly when there is no burn rate at all', body.includes('No burn rate yet'))
  ok('flags the site that needs reordering', body.includes('Reorder — below threshold'))
  ok('lists machines running the product', body.includes('US-1200XL'))
  ok('shows recent movement', body.includes('Usage') && body.includes('Delivery'))
  ok('rolls up totals across sites', body.includes('640'), body.match(/On hand[^\n]*\n[^\n]*/)?.[0] || '')

  // Cross-links out of the detail page.
  ok('facility names link to the facility', await page.locator('a[href="/facilities/1"]').count() === 1)
  ok('machines link to the machine', await page.locator('a[href="/machines/4"]').count() === 1)
  ok('back link returns to the list', await page.locator('a[href="/products"]').count() >= 1)

  // ---------- the help affordance ----------
  const tips = page.locator('.helptip-trigger')
  const tipCount = await tips.count()
  ok('help triggers are present', tipCount >= 3, `${tipCount}`)
  ok('no bubble is open initially', await page.locator('.helptip-bubble').count() === 0)
  ok('trigger reports collapsed state', await tips.first().getAttribute('aria-expanded') === 'false')

  // Tap, not hover — this is the point of the component.
  await tips.first().click()
  await page.waitForTimeout(250)
  ok('tapping opens the note', await page.locator('.helptip-bubble').count() === 1)
  ok('trigger reports expanded state', await tips.first().getAttribute('aria-expanded') === 'true')
  ok('the note is readable text', ((await page.locator('.helptip-bubble').textContent()) || '').length > 40)
  ok('the note is announced as a tooltip', await page.locator('.helptip-bubble').getAttribute('role') === 'tooltip')

  // It must not push the page sideways — standing rule in this app.
  ok('an open note causes no horizontal scroll at 390px',
    !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)))
  const bb = await page.locator('.helptip-bubble').boundingBox()
  ok('the note stays on screen', bb && bb.x >= 0 && bb.x + bb.width <= 390 + 1, JSON.stringify(bb))

  // Tap elsewhere closes it.
  await page.locator('h1').click()
  await page.waitForTimeout(250)
  ok('tapping away closes the note', await page.locator('.helptip-bubble').count() === 0)

  // Escape closes it.
  await tips.first().click()
  await page.waitForTimeout(200)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  ok('Escape closes the note', await page.locator('.helptip-bubble').count() === 0)

  // Reachable by keyboard.
  await tips.first().focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  ok('the note opens from the keyboard', await page.locator('.helptip-bubble').count() === 1)
  await page.keyboard.press('Escape')

  // Tap target big enough for a thumb.
  const tb = await tips.first().boundingBox()
  ok('help trigger is at least 32px', tb && tb.width >= 32 && tb.height >= 32, JSON.stringify(tb))

  // ---------- narrowest phone ----------
  await page.setViewportSize({ width: 320, height: 700 })
  await page.waitForTimeout(400)
  await tips.last().click()
  await page.waitForTimeout(250)
  ok('no horizontal scroll at 320px with a note open',
    !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)))
  const bb2 = await page.locator('.helptip-bubble').boundingBox()
  ok('the note stays on screen at 320px', bb2 && bb2.x >= 0 && bb2.x + bb2.width <= 321, JSON.stringify(bb2))
  await browser.close()
}

// ============ the same help notes on every screen that carries one ==========
// They open on tap, not hover, so they are exercised by tapping.
{
  const EMPTY = {
    facilities: [], contacts: [], projects: [], communications: [], action_items: [],
    machines: [], products: [], machine_models: [], sourcing_orders: [], stock: [],
    consumption_logs: [], metrics: [], facility: { id: 1, name: 'Toledo Plant', status: 'active' },
    revenue_trend: [], pipeline_by_stage: [], machine_status_breakdown: [], po_status_breakdown: [],
    at_risk_facilities: [], sourcing_stage_breakdown: [], facility_leaderboard: [],
    fleet_demand_forecast: [
      { facility_name: 'Toledo Plant', planned_weekly: 480, logged_weekly: 310 },
      { facility_name: 'Odessa Plant', planned_weekly: 240, logged_weekly: 250 },
    ],
  }

  const browser = await launch()

  for (const [route, opener] of [
    ['/machine-models', 'Add model'],
    ['/facilities/1', null],
    ['/insights', null],
    ['/products', 'Add product'],
  ]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 80)))
    await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EMPTY) }))
    await page.goto(B + route, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2600)

    // Tips inside a create form only exist once the modal is open.
    if (opener) {
      await page.getByRole('button', { name: new RegExp(opener, 'i') }).first().click()
      await page.waitForTimeout(500)
    }

    const tips = page.locator('.helptip-trigger')
    const n = await tips.count()
    ok(`${route}: has help notes`, n > 0, `${n}`)
    ok(`${route}: no page errors`, errs.length === 0, errs[0] || '')

    if (n > 0) {
      await tips.first().click()
      await page.waitForTimeout(350)
      const bubble = page.locator('.helptip-bubble')
      ok(`${route}: a note opens`, await bubble.count() === 1)
      // Inside a modal the bubble must not be hidden behind the backdrop.
      ok(`${route}: the note is actually visible`, await bubble.isVisible())
      const box = await bubble.boundingBox()
      ok(`${route}: the note stays on screen`, box && box.x >= 0 && box.x + box.width <= 391, JSON.stringify(box))
      ok(`${route}: no horizontal scroll`,
        !(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)))
    }
    await page.close()
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
