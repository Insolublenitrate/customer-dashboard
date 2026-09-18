'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Flame, Trophy } from 'lucide-react'
import { formatCompactCurrency, formatStatus, periodDelta } from '@/lib/format'

const MACHINE_STATUS_COLOR = {
  active: 'var(--success)',
  needs_service: 'var(--warning)',
  offline: 'var(--danger)',
  decommissioned: 'var(--muted-faint)',
}

const PO_STATUS_COLOR = {
  draft: 'var(--muted-faint)',
  submitted: 'var(--warning)',
  confirmed: 'var(--warning)',
  shipped: 'var(--accent)',
  fulfilled: 'var(--success)',
  cancelled: 'var(--danger)',
}

const RANK_ACCENT = ['#facc15', '#cbd5e1', '#d97706'] // gold, silver, bronze

function DeltaTag({ current, previous, invert }) {
  const { pct, direction } = periodDelta(current, previous)
  const isGood = invert ? direction === 'down' : direction === 'up'
  const color = direction === 'flat' ? 'var(--muted)' : isGood ? 'var(--success)' : 'var(--danger)'
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', color, fontWeight: 600 }}>
      <Icon size={13} />
      {pct === null ? 'new' : `${Math.abs(pct).toFixed(0)}%`}
    </span>
  )
}

function ChartTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass" style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)' }}>
      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontWeight: 600 }}>{formatter ? formatter(p.value) : p.value}</div>
      ))}
    </div>
  )
}

const SORT_OPTIONS = [
  { key: 'total_value', label: 'Value' },
  { key: 'machine_count', label: 'Machines' },
  { key: 'open_action_items', label: 'Open items' },
  { key: 'risk_score', label: 'Risk' },
]

export default function InsightsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('total_value')

  useEffect(() => {
    fetch('/api/insights')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load insights'))))
      .then(setData)
      .catch((err) => console.error('Failed to load insights:', err))
      .finally(() => setLoading(false))
  }, [])

  const sortedLeaderboard = useMemo(() => {
    if (!data) return []
    return [...data.facility_leaderboard].sort((a, b) => Number(b[sortKey]) - Number(a[sortKey]))
  }, [data, sortKey])

  if (loading) {
    return (
      <main className="container">
        <div className="loader" />
      </main>
    )
  }

  if (!data) {
    return (
      <main className="container">
        <div className="glass empty-state">Couldn&apos;t load insights. Try refreshing.</div>
      </main>
    )
  }

  const { deltas, revenue_trend: revenueTrend, pipeline_by_stage: pipelineByStage, machine_status_breakdown: machineStatus, po_status_breakdown: poStatus, at_risk_facilities: atRisk } = data

  const revenueChartData = revenueTrend.map((r) => ({
    month: new Date(r.month).toLocaleDateString('en-US', { month: 'short' }),
    revenue: Number(r.revenue),
  }))

  const pipelineChartData = pipelineByStage.filter((p) => p.count > 0).map((p) => ({ stage: formatStatus(p.status), count: p.count }))

  const machineStatusData = machineStatus.map((m) => ({ status: m.status, label: formatStatus(m.status), count: Number(m.count) }))
  const poStatusTotals = {}
  for (const row of poStatus) {
    poStatusTotals[row.status] = (poStatusTotals[row.status] || 0) + Number(row.count)
  }
  const poStatusData = Object.entries(poStatusTotals).map(([status, count]) => ({ status, label: formatStatus(status), count }))

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Insights</h1>
          <p>Trends, rankings, and where to look next.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="glass glass-card">
          <span className="metric-label">Revenue this month</span>
          <div className="metric-value">{formatCompactCurrency(deltas.revenue_this_month)}</div>
          <DeltaTag current={deltas.revenue_this_month} previous={deltas.revenue_last_month} />
        </div>
        <div className="glass glass-card">
          <span className="metric-label">Action items opened (7d)</span>
          <div className="metric-value">{deltas.items_this_week}</div>
          <DeltaTag current={deltas.items_this_week} previous={deltas.items_last_week} invert />
        </div>
        <div className="glass glass-card">
          <span className="metric-label">Communications (7d)</span>
          <div className="metric-value">{deltas.comms_this_week}</div>
          <DeltaTag current={deltas.comms_this_week} previous={deltas.comms_last_week} />
        </div>
        <div className="glass glass-card">
          <span className="metric-label">Facilities at risk</span>
          <div className="metric-value">{atRisk.length}</div>
        </div>
      </div>

      <div className="grid-responsive-2">
        {/* Power rankings */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trophy size={16} color="var(--warning)" />
              <h3 style={{ margin: 0 }}>Facility power rankings</h3>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className={`btn ${sortKey === opt.key ? '' : 'btn-secondary'}`}
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', minHeight: 'auto' }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {sortedLeaderboard.length === 0 ? (
            <p className="text-muted">No facilities yet.</p>
          ) : (
            <div className="row-list">
              {sortedLeaderboard.map((f, index) => (
                <Link key={f.id} href={`/facilities/${f.id}`} className="row-card" style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <span
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 26, height: 26, borderRadius: 999, fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                      color: index < 3 ? '#0a0a0a' : 'var(--muted)',
                      background: index < 3 ? RANK_ACCENT[index] : 'var(--surface)',
                    }}
                  >
                    {index + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong>{f.name}</strong>
                      {f.is_mother_location && <span className="badge" style={{ fontSize: '0.6875rem' }}>Mother</span>}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.8125rem', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                      <span>{formatCompactCurrency(f.total_value)} value</span>
                      <span>{f.machine_count} machine{f.machine_count === '1' ? '' : 's'}</span>
                      <span>{f.open_action_items} open item{f.open_action_items === '1' ? '' : 's'}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* At risk */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1rem' }}>
            <Flame size={16} color="var(--danger)" />
            <h3 style={{ margin: 0 }}>Needs the most attention</h3>
          </div>
          {atRisk.length === 0 ? (
            <p className="text-muted">Nothing flagged. Every facility is in good shape.</p>
          ) : (
            <div className="row-list">
              {atRisk.map((f) => (
                <Link key={f.id} href={`/facilities/${f.id}`} className="row-card" style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{f.name}</strong>
                    <div className="text-muted" style={{ fontSize: '0.8125rem', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                      {Number(f.overdue_action_items) > 0 && <span style={{ color: 'var(--danger)' }}>{f.overdue_action_items} overdue</span>}
                      {f.low_stock_flags > 0 && <span style={{ color: 'var(--warning)' }}>{f.low_stock_flags} low-stock item{f.low_stock_flags === 1 ? '' : 's'}</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {revenueChartData.length > 0 && (
        <div className="glass glass-card" style={{ marginTop: '1rem' }}>
          <h3>Revenue trend — fulfilled consumable orders</h3>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <AreaChart data={revenueChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={formatCompactCurrency} width={56} />
                <Tooltip content={<ChartTooltip formatter={formatCompactCurrency} />} />
                <Area type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={2} fill="url(#revenueFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid-responsive-3" style={{ marginTop: '1rem' }}>
        <div className="glass glass-card">
          <h3>Pipeline by stage</h3>
          {pipelineChartData.length === 0 ? <p className="text-muted">No projects yet.</p> : (
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={pipelineChartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barSize={16}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
                  <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass glass-card">
          <h3>Machines by status</h3>
          {machineStatusData.every((m) => m.count === 0) ? <p className="text-muted">No machines yet.</p> : (
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={machineStatusData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barSize={16}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {machineStatusData.map((m) => (
                      <Cell key={m.status} fill={MACHINE_STATUS_COLOR[m.status] || 'var(--primary)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass glass-card">
          <h3>Orders by status</h3>
          {poStatusData.length === 0 ? <p className="text-muted">No orders yet.</p> : (
            <div style={{ width: '100%', height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={poStatusData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barSize={16}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {poStatusData.map((p) => (
                      <Cell key={p.status} fill={PO_STATUS_COLOR[p.status] || 'var(--primary)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
