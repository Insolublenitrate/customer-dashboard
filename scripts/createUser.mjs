// One-off admin script: creates a login for this internal tool.
// There is no public sign-up form on purpose (see src/lib/auth.js).
//
// Usage: node scripts/createUser.mjs <email> <password> "<name>"

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const [, , email, password, name] = process.argv

if (!email || !password || !name) {
  console.error('Usage: node scripts/createUser.mjs <email> <password> "<name>"')
  process.exit(1)
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.')
  process.exit(1)
}
if (!process.env.POSTGRES_URL) {
  console.error('POSTGRES_URL is not set in .env.local')
  process.exit(1)
}

const { auth } = await import('../src/lib/auth.js')

const ctx = await auth.$context
const passwordHash = await ctx.password.hash(password)

const user = await ctx.internalAdapter.createUser(
  { email: email.toLowerCase(), name, emailVerified: true },
  { method: 'email-password' }
)
await ctx.internalAdapter.linkAccount({
  userId: user.id,
  providerId: 'credential',
  accountId: user.id,
  password: passwordHash,
})

console.log(`Created user ${user.email} (id ${user.id}). They can sign in at /login.`)
process.exit(0)
