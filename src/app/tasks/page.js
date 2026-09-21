'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Calendar, User } from 'lucide-react'
import MetricStrip from '../components/MetricStrip'
import ListSearch from '../components/ListSearch'
import VirtualList from '../components/VirtualList'
import LoadMore from '../components/LoadMore'
import { usePagedList } from '@/lib/usePagedList'
import { apiFetch } from '@/lib/apiFetch'

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState('open')

  const {
    items, total, hasMore, loading, loadingMore, loadMore,
    query, setQuery, reload: fetchItems,
  } = usePagedList({
    url: '/api/action-items',
    key: 'action_items',
    filters: { status: statusFilter },
  })

  const toggleItem = async (item) => {
    await apiFetch(`/api/action-items/${item.id}`, {
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

      <ListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search description, owner or facility"
        showing={items.length}
        total={total}
      />

      {loading ? (
        <div className="loader" />
      ) : items.length === 0 ? (
        // With search on the server, an empty list means one of two different
        // things and the message has to say which.
        <div className="glass empty-state">
          {query ? <>Nothing matches &ldquo;{query}&rdquo;.</> : 'Nothing here.'}
        </div>
      ) : (
        <>
          <VirtualList
            items={items}
            getKey={(item) => item.id}
            estimateHeight={116}
            gap={10}
            renderItem={(item) => {
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
            }}
          />
          <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} showing={items.length} total={total} />
        </>
      )}
    </main>
  )
}
