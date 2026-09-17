import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from './auth'

// id is null, not a fake string, because communications.uploaded_by is a real
// foreign key into better-auth's "user" table (ON DELETE SET NULL) — a
// non-existent id would fail that constraint on every upload.
const DEMO_SESSION = {
  user: { id: null, name: 'Demo User', email: 'demo@example.com' },
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
