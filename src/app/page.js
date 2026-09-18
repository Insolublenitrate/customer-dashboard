'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Ship } from 'lucide-react'
import { formatCompactCurrency } from '@/lib/format'
import MetricStrip from './components/MetricStrip'
import { apiFetch } from '@/lib/apiFetch'

const USMap = dynamic(() => import('./components/USMap'), { ssr: false })

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="glass" style={{ padding: '0.5rem 0.75rem', border: '1px solid var(--border-strong)' }}>
      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{formatCompactCurrency(payload[0].value)}</div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/dashboard')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load dashboard'))))
      .then(setData)
      .catch((err) => console.error('Failed to load dashboard:', err))
      .finally(() => setLoading(false))
  }, [])

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
        <div className="glass empty-state">Couldn&apos;t load the dashboard. Try refreshing.</div>
      </main>
    )
  }

  // Defaulted, not just destructured: if one aggregate is missing from the
  // payload the card that uses it goes quiet, rather than the whole dashboard
  // throwing on .map() and rendering nothing at all.
  const {
    facilities = [], stats = {}, overdue_action_items: overdueItems = [],
    needs_reorder: needsReorder = [], overdue_sourcing_orders: overdueSourcing = [],
    monthly_revenue: monthlyRevenue = [],
  } = data

  const chartData = monthlyRevenue.map((row) => ({
    month: new Date(row.month).toLocaleDateString('en-US', { month: 'short' }),
    revenue: Number(row.revenue),
  }))

  const attentionCount = overdueItems.length + needsReorder.length + overdueSourcing.length

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Overview</h1>
          <p>This customer account, at a glance.</p>
        </div>
      </div>

      <MetricStrip
        metrics={[
          { label: 'Needs attention', value: attentionCount, tone: attentionCount > 0 ? 'danger' : 'default' },
          { label: 'Pipeline value', value: stats.pipeline_value, format: 'currency' },
          { label: 'Open orders', value: Number(stats.open_incoming_po_value) + Number(stats.open_outgoing_po_value), format: 'currency' },
          { label: 'Active projects', value: stats.active_project_count },
          { label: 'Facilities', value: stats.facility_count },
          { label: 'Communications (7d)', value: stats.recent_communication_count },
        ]}
      />

      <div className="grid-responsive-2">
        <div className="glass glass-card">
          <h3>Needs attention</h3>
          {attentionCount === 0 ? (
            <p className="text-muted">Nothing overdue or low on stock. Nice.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {overdueItems.map((item) => (
                <Link
                  key={`ai-${item.id}`}
                  href={`/facilities/${item.facility_id}`}
                  style={{ textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--border)', paddingBottom: 8, display: 'block' }}
                >
                  <div>{item.description}</div>
                  <div style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                    {item.facility_name} · overdue since {new Date(item.due_date).toLocaleDateString()}
                  </div>
                </Link>
              ))}
              {needsReorder.map((s) => (
                <Link
                  key={`stock-${s.id}`}
                  href={`/facilities/${s.facility_id}`}
                  style={{ textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--border)', paddingBottom: 8, display: 'block' }}
                >
                  <div>{s.product_name} running low at {s.facility_name}</div>
                  <div style={{ color: 'var(--warning)', fontSize: '0.75rem' }}>
                    {s.quantity_on_hand} {s.unit} on hand{s.days_left !== null ? ` · ~${s.days_left} days left` : ''}
                  </div>
                </Link>
              ))}
              {overdueSourcing.map((o) => (
                <Link
                  key={`sourcing-${o.id}`}
                  href={`/sourcing/${o.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--border)', paddingBottom: 8, display: 'block' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ship size={13} /> {o.supplier_name} order past its ETA</div>
                  <div style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                    {o.facility_name ? `${o.facility_name} · ` : ''}expected {new Date(o.expected_arrival_date).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="glass glass-card map-card">
          <h3>Facility locations</h3>
          {facilities.length === 0 ? (
            <p className="text-muted">No facilities yet — add one to see it on the map.</p>
          ) : (
            <USMap facilities={facilities} />
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <div className="glass glass-card" style={{ marginTop: '1rem' }}>
          <h3>Fulfilled consumable order revenue</h3>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={24}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
                <XAxis dataKey="month" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCompactCurrency(v)}
                  width={56}
                />
                <Tooltip cursor={{ fill: 'var(--surface-hover)' }} content={<ChartTooltip />} />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </main>
  )
}
