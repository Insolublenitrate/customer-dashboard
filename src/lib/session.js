import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from './auth'
import { SYSTEM_ADMIN, ROLES } from './roles'

// id is null, not a fake string, because communications.uploaded_by is a real
// foreign key into better-auth's "user" table (ON DELETE SET NULL) — a
// non-existent id would fail that constraint on every upload.
// DEMO_ROLE picks which side of the split the demo shows; it defaults to the
// system admin so the public demo is not missing a panel. It only has any
// effect under DEMO_MODE, where there is no real session to speak of.
const demoRole = ROLES.includes(process.env.DEMO_ROLE) ? process.env.DEMO_ROLE : SYSTEM_ADMIN

const DEMO_SESSION = {
  user: { id: null, name: 'Demo User', email: 'demo@example.com', role: demoRole },
}

// API routes are hit directly (not only via page navigation), so they check
// the real session themselves rather than trusting proxy.js's cookie-presence
// check alone.
export async function requireSession() {
  // See proxy.js — DEMO_MODE skips real auth (and the better-auth DB call)
  // entirely, so uploads/writes still have a user id to attribute to.
  if (process.env.DEMO_MODE === 'true') {
    return { session: DEMO_SESSION, unauthorized: null }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { session: null, unauthorized: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session, unauthorized: null }
}

// Role check for routes that are not for everyone. Runs after requireSession,
// against the session the database returned — never against anything the client
// sent, and never against a hidden nav link, which is decoration.
export async function requireRole(...allowed) {
  const { session, unauthorized } = await requireSession()
  if (unauthorized) return { session: null, unauthorized }

  if (!allowed.includes(session.user?.role)) {
    // 403, not 404: the caller is signed in and the resource exists — they are
    // just not allowed. A 401 here would send apiFetch to the login page, which
    // would be a lie and an infinite loop for a signed-in user.
    return {
      session: null,
      unauthorized: NextResponse.json(
        { error: 'That area is restricted to the system administrator.' },
        { status: 403 }
      ),
    }
  }

  return { session, unauthorized: null }
}

export const requireSystemAdmin = () => requireRole(SYSTEM_ADMIN)
