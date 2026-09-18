'use client'

import { useEffect, useState } from 'react'
import { formatCompactCurrency } from '@/lib/format'

const TONE_COLOR = {
  danger: 'var(--danger)',
  warning: 'var(--warning)',
  success: 'var(--success)',
}

function formatValue(metric) {
  const value = Number(metric.value) || 0
  if (metric.format === 'currency') return formatCompactCurrency(value)
  if (metric.format === 'volume') return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} gal`
  if (metric.format === 'days') return `${value.toLocaleString()} d`
  return value.toLocaleString()
}

// A screen's own headline numbers, pulled live from /api/screen-metrics.
// `facilityId` is only used by the facility detail screen.
export default function MetricStrip({ screen, facilityId }) {
  const [metrics, setMetrics] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams({ screen })
    if (facilityId) params.set('facility_id', facilityId)

    let cancelled = false
    fetch(`/api/screen-metrics?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load metrics'))))
      .then((data) => {
        if (!cancelled) setMetrics(data.metrics || [])
      })
      .catch((err) => console.error('Failed to load screen metrics:', err))

    return () => { cancelled = true }
  }, [screen, facilityId])

  // The strip is supporting detail, so a failure stays silent rather than
  // pushing an error banner above the screen's actual content.
  if (!metrics?.length) return null

  return (
    <div className="metric-strip">
      {metrics.map((metric) => (
        <div key={metric.label} className="metric-strip-item" title={metric.hint || undefined}>
          <span className="metric-strip-label">{metric.label}</span>
          <span className="metric-strip-value" style={{ color: TONE_COLOR[metric.tone] }}>
            {formatValue(metric)}
          </span>
        </div>
      ))}
    </div>
  )
}
