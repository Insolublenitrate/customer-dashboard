import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { Pool } from 'pg'
import { accessControl, roles, SYSTEM_ADMIN, OWNER } from './roles'

// better-auth's Postgres/Kysely adapter needs a real `pg.Pool`, not the
// @neondatabase/serverless client @vercel/postgres wraps elsewhere in this
// app — so it gets its own pool over the same POSTGRES_URL.
export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.POSTGRES_URL }),
  emailAndPassword: {
    enabled: true,
    // Internal tool for a couple of people — accounts are created with
    // `node scripts/createUser.mjs`, not through a public sign-up form.
    disableSignUp: true,
  },
  plugins: [
    admin({
      ac: accessControl,
      roles,
      // Both roles reach the user-management endpoints; what separates them is
      // set-role and the `ai` statement, enforced per-permission in roles.js.
      adminRoles: [SYSTEM_ADMIN, OWNER],
      // An account created without an explicit role runs the business, not the
      // installation. Privilege is opted into, never defaulted into.
      defaultRole: OWNER,
    }),
  ],
})
