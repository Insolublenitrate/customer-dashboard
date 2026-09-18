export function formatCompactCurrency(value) {
  const n = Number(value) || 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function formatStatus(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

// { pct: number|null, direction: 'up'|'down'|'flat' }
export function periodDelta(current, previous) {
  const c = Number(current) || 0
  const p = Number(previous) || 0
  if (p === 0) return { pct: c > 0 ? null : 0, direction: c > 0 ? 'up' : 'flat' }
  const pct = ((c - p) / p) * 100
  return { pct, direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' }
}
