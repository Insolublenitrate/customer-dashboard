'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, User } from 'lucide-react'
import MetricStrip from '../components/MetricStrip'

export default function TasksPage() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')

  const fetchItems = () => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)

    fetch(`/api/action-items?${params}`)
      .then((res) => res.json())
      .then((data) => setItems(data.action_items || []))
      .catch((err) => console.error('Failed to load tasks:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchItems()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter])

  const toggleItem = async (item) => {
    await fetch(`/api/action-items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: item.status === 'open' ? 'done' : 'open' }),
    })
    fetchItems()
  }

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Tasks</h1>
          <p>Every action item across all facilities.</p>
        </div>
      </div>

      <MetricStrip screen="tasks" />

      <div className="filter-row">
        {[
          { value: 'open', label: 'Open' },
          { value: 'done', label: 'Done' },
          { value: '', label: 'All' },
        ].map((opt) => (
          <button
            key={opt.value}
            className={`btn ${statusFilter === opt.value ? '' : 'btn-secondary'}`}
            onClick={() => setStatusFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loader" />
      ) : items.length === 0 ? (
        <div className="glass empty-state">Nothing here.</div>
      ) : (
        <div className="row-list">
          {items.map((item) => {
            const isOverdue = item.status === 'open' && item.due_date && new Date(item.due_date) < new Date()
            return (
              <div key={item.id} className={`glass row-card ${item.status === 'done' ? 'is-done' : ''}`}>
                <input
                  type="checkbox"
                  checked={item.status === 'done'}
                  onChange={() => toggleItem(item)}
                  style={{ marginTop: 3, width: 18, height: 18, flexShrink: 0, accentColor: 'var(--primary)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ textDecoration: item.status === 'done' ? 'line-through' : 'none' }}>
                    {item.description}
                  </p>
                  <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.8125rem' }} className="text-muted">
                    <Link href={`/facilities/${item.facility_id}`} className="badge" style={{ textDecoration: 'none' }}>
                      {item.facility_name}
                    </Link>
                    {item.owner && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <User size={13} /> {item.owner}
                      </span>
                    )}
                    {item.due_date && (
                      <span
                        className={isOverdue ? undefined : 'text-muted'}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: isOverdue ? 'var(--danger)' : undefined }}
                      >
                        <Calendar size={13} /> {new Date(item.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
