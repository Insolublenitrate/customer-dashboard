import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { auth } from './auth'

// API routes are hit directly (not only via page navigation), so they check
// the real session themselves rather than trusting proxy.js's cookie-presence
// check alone.
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { session: null, unauthorized: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { session, unauthorized: null }
}
