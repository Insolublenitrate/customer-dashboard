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

  console.log('Creating machines...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS machines (
      id SERIAL PRIMARY KEY,
      facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      serial_number TEXT,
      model TEXT,
      install_date DATE,
      status TEXT NOT NULL DEFAULT 'active',
      default_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      tank_capacity NUMERIC,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `)

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

  console.log('Domain schema migration complete.')
  client.release()
  process.exit(0)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
