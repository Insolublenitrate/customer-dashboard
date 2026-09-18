'use client'

import { useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { MACHINE_STATUSES } from '@/lib/constants'
import { detergentPerFill, theoreticalWeeklyUsage } from '@/lib/consumption'

function formatStatus(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function MachineDetailPage({ params }) {
  const { id } = usePromise(params)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = () => {
    fetch(`/api/machines/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load machine'))))
      .then(setData)
      .catch((err) => console.error('Failed to load machine:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const updateStatus = async (status) => {
    await fetch(`/api/machines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data.machine, status }),
    })
    fetchData()
  }

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
        <Link href="/machines" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1.5rem', width: 'fit-content' }}>
          <ArrowLeft size={16} /> All machines
        </Link>
        <div className="glass empty-state">Couldn&apos;t find that machine.</div>
      </main>
    )
  }

  const { machine, consumption_logs: logs } = data
  const perFill = detergentPerFill(machine.tank_capacity)
  const weeklyUsage = theoreticalWeeklyUsage(machine)

  return (
    <main className="container">
      <Link href="/machines" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1.5rem', width: 'fit-content' }}>
        <ArrowLeft size={16} /> All machines
      </Link>

      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">{machine.model || 'Unnamed unit'}</h1>
          <p>
            <Link href={`/facilities/${machine.facility_id}`} style={{ color: 'var(--primary-hover)' }}>{machine.facility_name}</Link>
            {machine.serial_number ? ` · SN ${machine.serial_number}` : ''}
          </p>
        </div>
        <select className="input" value={machine.status} onChange={(e) => updateStatus(e.target.value)} style={{ width: 'auto' }}>
          {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
        </select>
      </div>

      <div className="grid-responsive-2">
        <div className="glass glass-card">
          <h3>Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.9375rem' }}>
            <div><span className="text-muted">Install date: </span>{machine.install_date ? new Date(machine.install_date).toLocaleDateString() : '—'}</div>
            {machine.machine_model_name && (
              <div><span className="text-muted">Machine model: </span>{machine.machine_model_name}</div>
            )}
            <div><span className="text-muted">Detergent: </span>{machine.default_product_name || '—'}</div>
            <div><span className="text-muted">Tank capacity: </span>{machine.tank_capacity ? `${Number(machine.tank_capacity).toLocaleString()} gal` : '—'}</div>
            <div><span className="text-muted">Fill cadence: </span>{machine.fill_frequency_per_week ? `~${machine.fill_frequency_per_week} fills/week` : '—'}</div>
            {perFill !== null && (
              <div><span className="text-muted">Detergent per fill: </span>~{perFill.toLocaleString(undefined, { maximumFractionDigits: 1 })} gal (10% of tank)</div>
            )}
            {weeklyUsage > 0 && (
              <div><span className="text-muted">Planned weekly draw: </span>~{weeklyUsage.toLocaleString(undefined, { maximumFractionDigits: 1 })} gal</div>
            )}
            {machine.project_title && (
              <div><span className="text-muted">Built from project: </span>{machine.project_title}</div>
            )}
            {machine.sourcing_order_id && (
              <div>
                <span className="text-muted">Sourced via: </span>
                <Link href={`/sourcing/${machine.sourcing_order_id}`} style={{ color: 'var(--primary-hover)' }}>
                  {machine.sourcing_supplier_name || `Order #${machine.sourcing_order_id}`}
                </Link>
              </div>
            )}
            {machine.notes && (
              <div style={{ marginTop: 8 }}>
                <span className="text-muted">Notes</span>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{machine.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div className="glass glass-card">
          <h3>Consumption history</h3>
          {logs.length === 0 ? (
            <p className="text-muted">No usage or deliveries logged against this machine yet. Log entries from the facility page.</p>
          ) : (
            <div className="row-list">
              {logs.map((log) => (
                <div key={log.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{formatStatus(log.type)} · {log.product_name}</span>
                    <span className={Number(log.quantity) < 0 ? undefined : 'text-muted'} style={{ color: Number(log.quantity) < 0 ? 'var(--warning)' : undefined }}>
                      {Number(log.quantity) > 0 ? '+' : ''}{log.quantity}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(log.logged_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
