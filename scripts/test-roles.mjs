// The role split, checked against the access-control definitions themselves
// rather than against what the UI happens to render. Hiding a button is not a
// permission; this is.
//
//   node scripts/test-roles.mjs
import { roles, SYSTEM_ADMIN, OWNER } from '../src/lib/roles.js'
import { costOf, AI_MODEL } from '../src/lib/aiConfig.js'

const results = []
const ok = (n, c, d = '') => results.push({ n, pass: !!c, d })

const perm = (role, statement, want, label) =>
  ok(label, roles[role].authorize(statement).success === want)

perm(SYSTEM_ADMIN, { ai: ['read-cost'] },      true,  'system admin can read AI cost')
perm(SYSTEM_ADMIN, { ai: ['read-config'] },    true,  'system admin can read AI config')
perm(SYSTEM_ADMIN, { ai: ['configure'] },      true,  'system admin can configure AI')
perm(SYSTEM_ADMIN, { user: ['set-role'] },     true,  'system admin can set roles')
perm(SYSTEM_ADMIN, { user: ['create'] },       true,  'system admin can create logins')

perm(OWNER, { user: ['create'] },              true,  'owner can create logins')
perm(OWNER, { user: ['list'] },                true,  'owner can list people')
perm(OWNER, { user: ['ban'] },                 true,  'owner can pause access')
perm(OWNER, { user: ['set-password'] },        true,  'owner can reset a password')
perm(OWNER, { user: ['delete'] },              true,  'owner can remove a login')

// The reservation the user asked for.
perm(OWNER, { ai: ['read-cost'] },             false, 'owner CANNOT read AI cost')
perm(OWNER, { ai: ['read-config'] },           false, 'owner CANNOT read AI config')
perm(OWNER, { ai: ['configure'] },             false, 'owner CANNOT configure AI')

// Without this the reservation is decorative: an owner who can set roles can
// make themselves a system admin and then read everything.
perm(OWNER, { user: ['set-role'] },            false, 'owner CANNOT set roles')

// Nobody was asked to have this, so nobody does.
perm(OWNER,        { user: ['impersonate'] },  false, 'owner CANNOT impersonate')
perm(SYSTEM_ADMIN, { user: ['impersonate'] },  false, 'system admin CANNOT impersonate either')

// Pricing, so a wrong figure on the System panel fails here first.
ok('1M in + 1M out costs $30 on ' + AI_MODEL,
  costOf({ model: AI_MODEL, input_tokens: 1e6, output_tokens: 1e6 }) === 30)
ok('a cache read is a tenth of the input rate',
  costOf({ model: AI_MODEL, cache_read_input_tokens: 1e6 }) === 0.5)
ok('a cache write is 1.25x the input rate',
  costOf({ model: AI_MODEL, cache_creation_input_tokens: 1e6 }) === 6.25)
ok('an unpriced model reports null rather than a made-up number',
  costOf({ model: 'not-a-model', input_tokens: 1e6 }) === null)

// scripts/createUser.mjs runs under plain node, not through Next's bundler, so
// every import in its chain must resolve without one. An extensionless
// `from './roles'` in auth.js resolves fine under Next and breaks the script —
// which is how account creation silently broke once already.
try {
  await import('../src/lib/auth.js')
  ok('src/lib/auth.js imports under plain node (createUser.mjs depends on it)', true)
} catch (err) {
  ok('src/lib/auth.js imports under plain node (createUser.mjs depends on it)', false, String(err).slice(0, 120))
}

let fail = 0
for (const r of results) { if (!r.pass) fail++; console.log(`${r.pass ? 'ok  ' : 'FAIL'}  ${r.n}${r.pass ? '' : `  -> ${r.d}`}`) }
console.log(`\n${results.length - fail} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
