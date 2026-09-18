// One-off admin script: creates a login for this internal tool.
// There is no public sign-up form on purpose (see src/lib/auth.js).
//
// Usage: node scripts/createUser.mjs <email> <password> "<name>" [role]
//
// role is `owner` (the default) or `system_admin`. The owner runs the business;
// the system admin also sees the AI model, key and spend, and is the only role
// that can change anyone's role.

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const [, , email, password, name, roleArg] = process.argv
const ROLES = ['owner', 'system_admin']
const role = roleArg || 'owner'

if (!email || !password || !name) {
  console.error('Usage: node scripts/createUser.mjs <email> <password> "<name>" [owner|system_admin]')
  process.exit(1)
}
if (!ROLES.includes(role)) {
  console.error(`Unknown role "${role}". Use one of: ${ROLES.join(', ')}`)
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
  { email: email.toLowerCase(), name, emailVerified: true, role },
  { method: 'email-password' }
)
await ctx.internalAdapter.linkAccount({
  userId: user.id,
  providerId: 'credential',
  accountId: user.id,
  password: passwordHash,
})

console.log(`Created ${role} ${user.email} (id ${user.id}). They can sign in at /login.`)
process.exit(0)
