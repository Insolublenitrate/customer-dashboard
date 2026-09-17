'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
          <p style={{ color: '#94a3b8' }}>Every action item across all facilities.</p>
        </div>
      </div>

      <div className="input-group">
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
        <div className="glass glass-card">Nothing here.</div>
      ) : (
        <div className="table-container glass">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Description</th>
                <th>Facility</th>
                <th>Owner</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ opacity: item.status === 'done' ? 0.5 : 1 }}>
                  <td>
                    <input type="checkbox" checked={item.status === 'done'} onChange={() => toggleItem(item)} />
                  </td>
                  <td style={{ textDecoration: item.status === 'done' ? 'line-through' : 'none' }}>{item.description}</td>
                  <td>
                    <Link href={`/facilities/${item.facility_id}`} style={{ color: '#60a5fa' }}>
                      {item.facility_name}
                    </Link>
                  </td>
                  <td>{item.owner || '—'}</td>
                  <td>
                    {item.due_date ? (
                      <span style={{ color: item.status === 'open' && new Date(item.due_date) < new Date() ? '#f87171' : 'inherit' }}>
                        {new Date(item.due_date).toLocaleDateString()}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
