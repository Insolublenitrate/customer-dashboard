// Creates better-auth's own tables (user, session, account, verification).
//
// This is hand-written SQL rather than a call to `@better-auth/cli` — that
// package is flagged deprecated on npm and drags in an old, vulnerable
// nested copy of better-auth as of when this was written. The schema below
// was instead read directly out of the *installed* better-auth package's
// own migration generator (node_modules/better-auth/dist/db/get-migration.mjs)
// for the exact options this app uses (emailAndPassword only, default
// string/text ids), so it matches what that generator would produce.
// If you add better-auth plugins later (OAuth providers, 2FA, etc.), re-check
// that source for the extra columns/tables they need.
//
// Usage: node scripts/migrateAuth.js

require('dotenv').config({ path: '.env.local' })
const { db } = require('@vercel/postgres')

async function migrate() {
  if (!process.env.POSTGRES_URL) {
    console.error('ERROR: POSTGRES_URL is not set in .env.local')
    process.exit(1)
  }

  const client = await db.connect()

  console.log('Creating "user"...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS "user" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "emailVerified" BOOLEAN NOT NULL DEFAULT false,
      image TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  console.log('Creating "session"...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      id TEXT PRIMARY KEY,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      token TEXT NOT NULL UNIQUE,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
    );
  `)

  console.log('Creating "account"...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS "account" (
      id TEXT PRIMARY KEY,
      "accountId" TEXT NOT NULL,
      "providerId" TEXT NOT NULL,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "idToken" TEXT,
      "accessTokenExpiresAt" TIMESTAMPTZ,
      "refreshTokenExpiresAt" TIMESTAMPTZ,
      scope TEXT,
      password TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL
    );
  `)

  console.log('Creating "verification"...')
  await client.query(`
    CREATE TABLE IF NOT EXISTS "verification" (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      "expiresAt" TIMESTAMPTZ NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Columns the admin plugin adds. Read out of the installed package's own
  // schema (node_modules/better-auth/dist/plugins/admin/schema.mjs) rather than
  // guessed, same as the tables above. ADD COLUMN IF NOT EXISTS keeps this
  // re-runnable on a database created before roles existed.
  console.log('Adding admin plugin columns...')
  await client.query(`
    ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS role TEXT,
      ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS "banReason" TEXT,
      ADD COLUMN IF NOT EXISTS "banExpires" TIMESTAMPTZ;
  `)
  await client.query(`
    ALTER TABLE "session"
      ADD COLUMN IF NOT EXISTS "impersonatedBy" TEXT;
  `)

  // Anyone who existed before roles did runs the business; the installation
  // role is granted deliberately, never inherited by being early.
  const backfilled = await client.query(`UPDATE "user" SET role = 'owner' WHERE role IS NULL`)
  if (backfilled.rowCount > 0) {
    console.log(`Backfilled ${backfilled.rowCount} existing user(s) to the owner role.`)
  }

  console.log('Auth schema migration complete.')
  client.release()
  process.exit(0)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
