import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements } from 'better-auth/plugins/admin/access'

export const SYSTEM_ADMIN = 'system_admin'
export const OWNER = 'owner'
export const ROLES = [SYSTEM_ADMIN, OWNER]

export const ROLE_LABELS = {
  [SYSTEM_ADMIN]: 'System admin',
  [OWNER]: 'Owner',
}

export const ROLE_DESCRIPTIONS = {
  [SYSTEM_ADMIN]: 'Runs the installation: everything the owner can do, plus the AI model, key and spend.',
  [OWNER]: 'Runs the business: every facility, machine, order and person. Does not see AI cost or configuration.',
}

// `ai` is this app's own statement; the rest come from better-auth's admin
// plugin so its built-in user endpoints keep working.
const statement = {
  ...defaultStatements,
  ai: ['read-config', 'read-cost', 'configure'],
}

const ac = createAccessControl(statement)

const systemAdmin = ac.newRole({
  user: ['create', 'list', 'set-role', 'ban', 'delete', 'set-password', 'set-email', 'get', 'update'],
  session: ['list', 'revoke', 'delete'],
  ai: ['read-config', 'read-cost', 'configure'],
})

// The owner administers the business, people included — it is their business.
// Two powers are held back on purpose:
//   set-role, because an owner who can hand themselves system_admin makes the
//     AI reservation decorative rather than enforced;
//   ai, which is the reservation itself.
// Nobody gets `impersonate`: signing in as another person was not asked for and
// is a poor default for a two-person tool.
const owner = ac.newRole({
  user: ['create', 'list', 'ban', 'delete', 'set-password', 'set-email', 'get', 'update'],
  session: ['list', 'revoke'],
  ai: [],
})

export const accessControl = ac
export const roles = { [SYSTEM_ADMIN]: systemAdmin, [OWNER]: owner }
