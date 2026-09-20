// Stress the front end: volume, hostile input, and an impatient double-tap.
//
// Findings on 2026-09-20 that turned into fixes:
//   - a 200-character unbroken name took a 390px screen to 1,605px of
//     horizontal scroll (fixed by overflow-wrap rules in globals.css)
//   - 600 machines render a page 101,700px tall, about 240 phone screens, with
//     no way to reach one (fixed by ListSearch)
// And two that were already sound, which is worth keeping a check on:
//   - markup in a record name is escaped, not executed
//   - three fast taps on Save create one record, not three
//
//   1. npm run dev
//   2. node scripts/stress-ui.mjs
//
// Needs playwright; set PLAYWRIGHT_PACKAGE to an absolute path if it is
// installed globally rather than in this project.
const playwrightPath = process.env.PLAYWRIGHT_PACKAGE || 'playwright'
const pwmod = await import(playwrightPath)
const { chromium } = pwmod.default ?? pwmod
const B = process.env.BASE_URL || 'http://localhost:3000'
const out = []
const note = (n, v, verdict = '') => out.push({ n, v, verdict })

// A hostile-but-plausible name: long, unicode, and markup that must never run.
const NASTY = 'Ω'.repeat(3) + ' <img src=x onerror="window.__XSS=1"> ' +
  '<script>window.__XSS2=1</script> ' + 'Verylongunbrokenfacilitynamewithnospacesatall'.repeat(4)

const mk = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1))

const BIG = {
  machines: mk(600, (i) => ({ id: i, model: `Model-${i % 8}`, serial_number: `SN-${i}`, status: 'active',
    facility_id: 1 + (i % 25), facility_name: `Facility ${1 + (i % 25)}`, tank_capacity: '1200.00',
    fill_frequency_per_week: '4.0', default_product_name: 'Detergent 1', machine_model_name: `Model-${i % 8}` })),
  facilities: mk(25, (i) => ({ id: i, name: `Facility ${i}`, city: `City ${i}`, state: 'OH', status: 'active', is_mother_location: i === 1 })),
  products: mk(12, (i) => ({ id: i, name: `Detergent ${i}`, sku: `SKU-${i}`, unit: 'gallon', unit_price: '18.50', supplier_name: 'Acme', reorder_lead_time_days: 14 })),
  purchase_orders: mk(600, (i) => ({ id: i, direction: i % 2 ? 'outgoing' : 'incoming', facility_id: 1, facility_name: 'Facility 1',
    supplier_name: 'Acme', status: 'confirmed', po_number: `PO-${i}`, expected_date: '2026-10-01T00:00:00.000Z', total_value: '1200', items: [] })),
  action_items: mk(800, (i) => ({ id: i, description: `Follow up ${i}`, status: i % 3 ? 'open' : 'done',
    facility_id: 1, facility_name: 'Facility 1', due_date: '2026-09-01T00:00:00.000Z' })),
  metrics: [], machine_models: [], sourcing_orders: [], contacts: [], projects: [], communications: [],
  stock: [], consumption_logs: [],
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })

// ---------------- 1. Volume: how long do big lists take to become usable? ----
for (const [route, label, count] of [['/machines', 'machines', 600], ['/orders', 'orders', 600], ['/tasks', 'tasks', 800]]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 70)))
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BIG) }))
  const t0 = Date.now()
  await page.goto(B + route, { waitUntil: 'domcontentloaded' })
  // Wait until the rows are actually on screen.
  await page.waitForFunction(() => document.querySelectorAll('.glass-card, .row-list > *, tr').length > 50, null, { timeout: 30000 }).catch(() => {})
  const ms = Date.now() - t0
  await page.waitForTimeout(800)
  const stats = await page.evaluate(() => ({
    nodes: document.querySelectorAll('*').length,
    height: document.documentElement.scrollHeight,
    xscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }))
  note(`${route} with ${count} rows`, `${ms} ms to render · ${stats.nodes.toLocaleString()} DOM nodes · ${(stats.height/1000).toFixed(1)}k px tall`,
    errs.length ? `ERRORS: ${errs[0]}` : (stats.xscroll ? 'H-SCROLL' : ''))
  await page.close()
}

// ---------------- 2. Hostile strings -----------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 70)))
  const nasty = { ...BIG, facilities: [{ id: 1, name: NASTY, city: NASTY, state: 'OH', status: 'active', is_mother_location: false }] }
  await page.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(nasty) }))
  await page.goto(`${B}/facilities`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const res = await page.evaluate(() => ({
    xss: !!(window.__XSS || window.__XSS2),
    xscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    scrollW: document.documentElement.scrollWidth,
    // Did the raw markup get rendered as an element, or shown as text?
    // Only an injected element counts. An earlier version also counted
    // script:not([src]), which matches Next.js's own inline bootstrap and
    // reported an injection that had not happened.
    injected: document.querySelectorAll('img[src="x"]').length,
    shownAsText: document.body.innerText.includes('<img src=x'),
  }))
  note('script injected via a record name', res.xss ? 'EXECUTED' : 'not executed',
    res.xss ? 'XSS' : (res.injected > 0 ? 'element created' : ''))
  note('markup is shown as text, not parsed', res.shownAsText ? 'yes' : 'no', res.shownAsText ? '' : 'check')
  note('a 200-char unbroken name at 390px', res.xscroll ? `overflows to ${res.scrollW}px` : 'wraps, no overflow',
    res.xscroll ? 'H-SCROLL' : '')
  if (errs.length) note('page errors on hostile input', errs[0], 'ERRORS')
  await page.close()
}

// ---------------- 3. Double-submit --------------------------------------------
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const posts = []
  await page.route('**/api/**', async (r) => {
    const req = r.request()
    if (req.method() === 'POST') {
      posts.push(req.url())
      // A slow server is exactly when someone taps twice.
      await new Promise((res) => setTimeout(res, 900))
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BIG) })
  })
  await page.goto(`${B}/machine-models`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.getByRole('button', { name: /Add model/i }).first().click()
  await page.waitForTimeout(400)
  await page.locator('input[name=name]').fill('Impatient Model')
  await page.locator('input[name=tank_capacity]').fill('1000')
  const submit = page.locator('form button[type=submit]')
  // Three fast taps, the way a person on a slow connection actually behaves.
  await submit.click()
  await submit.click({ force: true }).catch(() => {})
  await submit.click({ force: true }).catch(() => {})
  await page.waitForTimeout(2000)
  note('three fast taps on Save', `${posts.length} record(s) created`, posts.length > 1 ? 'DUPLICATES' : '')
  await page.close()
}

await browser.close()
for (const o of out) console.log(`${(o.verdict ? '!! ' : 'ok ')}${o.n.padEnd(42)} ${o.v}${o.verdict ? '   <-- ' + o.verdict : ''}`)
