'use client'

// Every data request goes through here so an expired session cannot strand
// someone inside the app.
//
// proxy.js only checks that a session cookie exists — it deliberately does not
// hit the database. So when a session expires server-side while the cookie is
// still in the browser, the proxy waves the request through, every API call
// comes back 401, and each screen renders its "couldn't load" state. Refreshing
// re-runs the same cookie check and lands in the same place, and the sign-out
// button is hidden at exactly that moment because useSession() has nothing to
// show. Without this, the only ways out are clearing cookies or knowing to type
// /login by hand.

let redirecting = false

export async function apiFetch(input, init) {
  const res = await fetch(input, init)

  if (res.status !== 401 || typeof window === 'undefined') return res
  if (window.location.pathname === '/login') return res

  // A screen fires several requests at once and they all 401 together; only the
  // first should navigate.
  if (!redirecting) {
    redirecting = true
    const from = window.location.pathname + window.location.search
    // replace, not assign: Back should not return to the screen that just
    // failed to load.
    window.location.replace(`/login?from=${encodeURIComponent(from)}`)
  }

  // Deliberately never settles. The page is on its way to /login, and resolving
  // would let the caller run its .catch/.finally and paint an error state for
  // the moment before navigation completes.
  return new Promise(() => {})
}
