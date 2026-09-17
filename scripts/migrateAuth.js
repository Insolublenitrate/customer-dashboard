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

  console.log('Auth schema migration complete.')
  client.release()
  process.exit(0)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
