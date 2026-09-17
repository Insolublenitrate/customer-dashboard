import { betterAuth } from 'better-auth'
import { Pool } from 'pg'

// better-auth's Postgres/Kysely adapter needs a real `pg.Pool`, not the
// @neondatabase/serverless client @vercel/postgres wraps elsewhere in this
// app — so it gets its own pool over the same POSTGRES_URL.
export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.POSTGRES_URL }),
  emailAndPassword: {
    enabled: true,
    // Internal tool for a couple of people — accounts are created with
    // `node scripts/createUser.js`, not through a public sign-up form.
    disableSignUp: true,
  },
})
