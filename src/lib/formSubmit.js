import { apiFetch } from './apiFetch'

// The client and the server validate against the same schema, so a 400 here
// means the server caught something the client could not — a stale select
// option, a cross-field rule, a race. Either way the message belongs on the
// field it names, not in an alert() that loses which input was wrong.
//
// Returns the parsed body on success, or null once the error has been placed
// on the form. Goes through apiFetch so a save attempted on an expired session
// sends the user to sign in again rather than putting "Unauthorized" on a field.
export async function submitJson({ url, method = 'POST', data, setError, fallback }) {
  let res
  try {
    res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  } catch (err) {
    console.error(fallback, err)
    setError('root', { message: 'Could not reach the server. Check your connection and try again.' })
    return null
  }

  if (res.ok) return res.json().catch(() => ({}))

  const body = await res.json().catch(() => ({}))
  const message = body.error || fallback
  // `field` is set by validationError() in src/lib/schemas.js; without it the
  // message has no home but the form root.
  setError(body.field || 'root', { message })
  return null
}
