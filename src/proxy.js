import { NextResponse } from 'next/server'
import { getSessionCookie } from 'better-auth/cookies'

const PUBLIC_PATHS = new Set(['/login'])

// Cheap, DB-free check: does a session cookie exist at all. Routes and API
// handlers that need the real, DB-backed session call auth.api.getSession()
// themselves — this middleware only keeps signed-out visitors out.
export function proxy(request) {
  // DEMO_MODE turns off the login wall for a public demo. Anyone with the
  // URL can view and edit whatever is in the database — set DEMO_MODE back
  // to unset/false before putting real customer data in.
  if (process.env.DEMO_MODE === 'true') {
    return NextResponse.next()
  }

  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  const sessionCookie = getSessionCookie(request)
  if (!sessionCookie) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|states-10m.json).*)'],
}
