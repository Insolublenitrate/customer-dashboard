// Shared paging for the list endpoints.
//
// These routes used to return every row. Measured on 2026-09-20 against a few
// years of this account, /machines sent 600 rows and the client rendered a page
// 101,700px tall. Paging keeps the wire small; virtualizing keeps the DOM small.
// Both are needed — one does not replace the other.

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

// Caps rather than trusts. A client asking for limit=1000000 gets MAX_LIMIT,
// and a junk value gets the default, so a bad query string cannot ask the
// database for the whole table.
export function readPaging(searchParams) {
  const rawLimit = Number(searchParams.get('limit'))
  const rawOffset = Number(searchParams.get('offset'))

  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
    : DEFAULT_LIMIT
  const offset = Number.isFinite(rawOffset) && rawOffset > 0
    ? Math.floor(rawOffset)
    : 0

  const q = (searchParams.get('q') || '').trim()

  return { limit, offset, q }
}

// Builds a case-insensitive contains-match across the given columns.
//
// The term goes in as a parameter, never interpolated; only the column names
// come from the caller, and those are literals in the route files rather than
// anything a request controls. `%` and `_` in the user's term are escaped so a
// search for "50%" does not become a wildcard.
export function searchClause(columns, term, nextParamIndex) {
  if (!term) return { sql: '', params: [] }
  const escaped = term.replace(/([%_\\])/g, '\\$1')
  const ors = columns.map((c) => `${c} ILIKE $${nextParamIndex}`).join(' OR ')
  return { sql: ` AND (${ors})`, params: [`%${escaped}%`] }
}

// One query, not two: COUNT(*) OVER() rides along with the page so the client
// can say "50 of 600" without a second round trip. The count is of rows
// matching the filters, before LIMIT.
export function pagedResult(rows, { limit, offset }) {
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0
  const items = rows.map(({ total_count, ...rest }) => rest)
  return {
    items,
    total,
    limit,
    offset,
    has_more: offset + items.length < total,
  }
}
