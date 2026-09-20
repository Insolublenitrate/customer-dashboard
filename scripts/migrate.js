// Creates the app's domain schema (facilities, contacts, projects,
// communications, action_items) and drops the old demo `leads` table.
//
// better-auth's own tables (user, session, account, verification) are
// managed separately — run `npm run auth:migrate` for those, since their
// exact schema is owned by the better-auth package, not this script.
//
// Usage: node scripts/migrate.js

require('dotenv').config({ path: '.env.local' })
const { db } = require('@vercel/postgres')

async function migrate() {
  if (!process.env.POSTGRES_URL) {
    console.error('ERROR: POSTGRES_URL is not set in .env.local')
    process.exit(1)
  }

  const client = await db.connect()

  console.log('Dropping old demo table (leads)...')
  await client.query(`DROP TABLE IF EXISTS leads;`)

  console.log('Creating facilities...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS facilities (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      is_mother_location BOOLEAN NOT NULL DEFAULT false,
      address TEXT,
      city TEXT,
      state TEXT,
      zip TEXT,
      region TEXT,
      regulatory_notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating contacts...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      title TEXT,
      email TEXT,
      phone TEXT,
      is_primary BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating projects...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      spec_summary TEXT,
      status TEXT NOT NULL DEFAULT 'discovery',
      quote_value NUMERIC,
      target_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating communications...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS communications (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'other',
      source_filename TEXT,
      storage_url TEXT,
      raw_text TEXT,
      ai_summary TEXT,
      occurred_at TIMESTAMPTZ,
      participants TEXT[],
      uploaded_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating action_items...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS action_items (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      communication_id INTEGER REFERENCES communications(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      owner TEXT,
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating products...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT,
      unit TEXT NOT NULL DEFAULT 'gallon',
      unit_price NUMERIC,
      supplier_name TEXT,
      reorder_lead_time_days INTEGER NOT NULL DEFAULT 14,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating machine_models...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS machine_models (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      tank_capacity NUMERIC NOT NULL,
      fill_frequency_per_week NUMERIC,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating machines...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS machines (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      machine_model_id INTEGER REFERENCES machine_models(id) ON DELETE SET NULL,
      serial_number TEXT,
      model TEXT,
      install_date DATE,
      status TEXT NOT NULL DEFAULT 'active',
      default_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      tank_capacity NUMERIC,
      fill_frequency_per_week NUMERIC,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  // Existing deployments already have `machines` without these columns —
  // idempotent for installs created before machine models/sizing existed.
  await client.query(`ALTER TABLE machines ADD COLUMN IF NOT EXISTS machine_model_id INTEGER REFERENCES machine_models(id) ON DELETE SET NULL;`)
  await client.query(`ALTER TABLE machines ADD COLUMN IF NOT EXISTS fill_frequency_per_week NUMERIC;`)

  console.log('Creating consumable_stock...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS consumable_stock (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity_on_hand NUMERIC NOT NULL DEFAULT 0,
      reorder_threshold NUMERIC NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'gallon',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (facility_id, product_id)
    );
  `)

  console.log('Creating consumption_logs...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS consumption_logs (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      machine_id INTEGER REFERENCES machines(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'usage',
      quantity NUMERIC NOT NULL,
      logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT,
      created_by TEXT REFERENCES "user"(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating purchase_orders...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id SERIAL PRIMARY KEY,
      direction TEXT NOT NULL DEFAULT 'incoming',
      facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
      supplier_name TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      po_number TEXT,
      expected_date DATE,
      total_value NUMERIC,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating purchase_order_items...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id SERIAL PRIMARY KEY,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      description TEXT,
      quantity NUMERIC NOT NULL DEFAULT 1,
      unit_price NUMERIC,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating machine_sourcing_orders...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS machine_sourcing_orders (
      id SERIAL PRIMARY KEY,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
      machine_model_id INTEGER REFERENCES machine_models(id) ON DELETE SET NULL,
      supplier_name TEXT NOT NULL,
      supplier_country TEXT,
      quantity INTEGER NOT NULL DEFAULT 1,
      stage TEXT NOT NULL DEFAULT 'order_placed',
      order_date DATE,
      deposit_amount NUMERIC,
      deposit_paid_date DATE,
      total_cost NUMERIC,
      expected_ship_date DATE,
      actual_ship_date DATE,
      expected_arrival_date DATE,
      actual_arrival_date DATE,
      container_number TEXT,
      vessel_name TEXT,
      carrier TEXT,
      port_of_origin TEXT,
      port_of_destination TEXT,
      tracking_url TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  console.log('Creating sourcing_order_events...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS sourcing_order_events (
      id SERIAL PRIMARY KEY,
      sourcing_order_id INTEGER NOT NULL REFERENCES machine_sourcing_orders(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

  // Links an installed machine back to the sourcing order that brought it in.
  await client.query(`ALTER TABLE machines ADD COLUMN IF NOT EXISTS sourcing_order_id INTEGER REFERENCES machine_sourcing_orders(id) ON DELETE SET NULL;`)

  console.log('Creating ai_briefings...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_briefings (
      id SERIAL PRIMARY KEY,
      headline TEXT NOT NULL,
      findings JSONB NOT NULL,
      model TEXT,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)


  // One row per Claude call, so AI spend is a number the system admin can read
  // rather than a surprise on a card statement. Token counts come straight off
  // the Messages API response; cost is computed at query time from the rates in
  // src/lib/aiConfig.js, so a price change does not require rewriting history.
  console.log('Creating ai_usage...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS ai_usage (
      id SERIAL PRIMARY KEY,
      feature TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cache_creation_input_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_input_tokens INTEGER NOT NULL DEFAULT 0,
      ok BOOLEAN NOT NULL DEFAULT true,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)
  await client.query(`CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON ai_usage (created_at DESC);`)


  // Postgres does not index a foreign key for you, and this schema had exactly
  // one index in it. Every WHERE facility_id = $1 and every join was a
  // sequential scan.
  //
  // Measured on 2026-09-20 against 25 facilities, 600 machines and 43,800
  // consumption logs — a few years of this account:
  //
  //   facility stock (the reorder forecast)   35.7 ms  ->  1.2 ms
  //   product detail stock                    71.9 ms  ->  1.5 ms
  //   machine detail logs                      3.0 ms  ->  0.5 ms
  //   facility consumption history             3.8 ms  ->  0.5 ms
  //
  // The column order matters: each one matches how the query filters, so the
  // 60-day usage sub-select can seek rather than scan.
  console.log('Creating indexes...')
  await client.query(`
    CREATE INDEX IF NOT EXISTS consumption_logs_fac_prod_at_idx
      ON consumption_logs (facility_id, product_id, logged_at DESC);
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS consumption_logs_machine_at_idx
      ON consumption_logs (machine_id, logged_at DESC);
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS consumption_logs_fac_at_idx
      ON consumption_logs (facility_id, logged_at DESC);
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS machines_fac_prod_idx
      ON machines (facility_id, default_product_id);
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS consumable_stock_product_idx
      ON consumable_stock (product_id);
  `)
  // The remaining foreign keys, so a facility page's other sections and the
  // cascade deletes do not scan either.
  await client.query(`
    CREATE INDEX IF NOT EXISTS contacts_facility_idx        ON contacts (facility_id);
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS projects_facility_idx        ON projects (facility_id);
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS communications_facility_idx  ON communications (facility_id);
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS action_items_facility_idx    ON action_items (facility_id);
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS purchase_orders_facility_idx ON purchase_orders (facility_id);
  `)
  await client.query(`
    CREATE INDEX IF NOT EXISTS machines_model_idx           ON machines (machine_model_id);
  `)

  console.log('Domain schema migration complete.')
  client.release()
  process.exit(0)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
