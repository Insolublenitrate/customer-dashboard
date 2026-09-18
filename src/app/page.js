'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Building2, ClipboardList, MessageSquare, AlertTriangle } from 'lucide-react'

const USMap = dynamic(() => import('./components/USMap'), { ssr: false })

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
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

  const { facilities, stats, overdue_action_items: overdueItems } = data

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Overview</h1>
          <p style={{ color: 'var(--muted)' }}>This customer account, at a glance.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="glass glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} color="var(--primary-hover)" />
            <span className="metric-label">Facilities</span>
          </div>
          <div className="metric-value">{stats.facility_count}</div>
        </div>
        <div className="glass glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={18} color="var(--accent)" />
            <span className="metric-label">Active projects</span>
          </div>
          <div className="metric-value">{stats.active_project_count}</div>
        </div>
        <div className="glass glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} color="var(--warning)" />
            <span className="metric-label">Open action items</span>
          </div>
          <div className="metric-value">{stats.open_action_item_count}</div>
        </div>
        <div className="glass glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={18} color="var(--success)" />
            <span className="metric-label">Communications (7d)</span>
          </div>
          <div className="metric-value">{stats.recent_communication_count}</div>
        </div>
      </div>

      <div className="grid-responsive-2">
        <div className="glass glass-card map-card">
          <h3>Facility locations</h3>
          {facilities.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No facilities yet — add one to see it on the map.</p>
          ) : (
            <USMap facilities={facilities} />
          )}
        </div>

        <div className="glass glass-card">
          <h3>Needs attention</h3>
          {overdueItems.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Nothing overdue. Nice.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {overdueItems.map((item) => (
                <Link
                  key={item.id}
                  href={`/facilities/${item.facility_id}`}
                  style={{ textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--border)', paddingBottom: 8, display: 'block' }}
                >
                  <div>{item.description}</div>
                  <div style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>
                    {item.facility_name} · overdue since {new Date(item.due_date).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
