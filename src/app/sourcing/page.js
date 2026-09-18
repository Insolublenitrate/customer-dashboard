'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Ship, Plus, X, AlertTriangle } from 'lucide-react'
import { SOURCING_STAGES } from '@/lib/constants'
import { formatStatus } from '@/lib/format'

const emptyForm = {
  project_id: '', facility_id: '', machine_model_id: '', supplier_name: '', supplier_country: '',
  quantity: 1, order_date: '', total_cost: '', expected_ship_date: '', expected_arrival_date: '', notes: '',
}

const STAGE_BADGE = {
  order_placed: '',
  in_production: 'badge-warning',
  quality_check: 'badge-warning',
  shipped: '',
  in_transit: '',
  customs: 'badge-warning',
  arrived: 'badge-success',
  installed: 'badge-success',
}

function daysUntil(dateStr) {
  if (!dateStr) return null
  const diffMs = new Date(dateStr).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(diffMs / 86400000)
}

export default function SourcingPage() {
  const [orders, setOrders] = useState([])
  const [facilities, setFacilities] = useState([])
  const [projects, setProjects] = useState([])
  const [machineModels, setMachineModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const fetchAll = () => {
    const params = new URLSearchParams()
    if (stageFilter) params.set('stage', stageFilter)

    Promise.all([
      fetch(`/api/sourcing-orders?${params}`).then((r) => (r.ok ? r.json() : { sourcing_orders: [] })),
      fetch('/api/facilities').then((r) => (r.ok ? r.json() : { facilities: [] })),
      fetch('/api/projects').then((r) => (r.ok ? r.json() : { projects: [] })),
      fetch('/api/machine-models').then((r) => (r.ok ? r.json() : { machine_models: [] })),
    ])
      .then(([ordersData, facData, projData, modelsData]) => {
        setOrders(ordersData.sourcing_orders || [])
        setFacilities(facData.facilities || [])
        setProjects(projData.projects || [])
        setMachineModels(modelsData.machine_models || [])
      })
      .catch((err) => console.error('Failed to load sourcing orders:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageFilter])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch('/api/sourcing-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to create sourcing order')
      setIsModalOpen(false)
      setForm(emptyForm)
      fetchAll()
    } catch (err) {
      console.error(err)
      alert('Failed to create sourcing order')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Sourcing</h1>
          <p>Machines on order from overseas manufacturers — builds and container shipments.</p>
        </div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          New sourcing order
        </button>
      </div>

      <div className="input-group">
        <button className={`btn ${stageFilter === '' ? '' : 'btn-secondary'}`} onClick={() => setStageFilter('')}>All</button>
        {SOURCING_STAGES.map((s) => (
          <button key={s} className={`btn ${stageFilter === s ? '' : 'btn-secondary'}`} onClick={() => setStageFilter(s)} style={{ whiteSpace: 'nowrap' }}>
            {formatStatus(s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loader" />
      ) : orders.length === 0 ? (
        <div className="glass empty-state">No sourcing orders yet. Add one when you place a build with a manufacturer.</div>
      ) : (
        <div className="metrics-grid">
          {orders.map((o) => {
            const eta = daysUntil(o.expected_arrival_date)
            const overdue = eta !== null && eta < 0 && o.stage !== 'arrived' && o.stage !== 'installed'
            return (
              <Link key={o.id} href={`/sourcing/${o.id}`} className="glass glass-card interactive" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Ship size={18} color="var(--primary-hover)" />
                  <h3 style={{ margin: 0 }}>{o.supplier_name}</h3>
                </div>
                <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 12 }}>
                  {o.machine_model_name || 'Machine build'}{o.quantity > 1 ? ` × ${o.quantity}` : ''}
                  {o.facility_name ? ` → ${o.facility_name}` : ''}
                </p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className={`badge ${STAGE_BADGE[o.stage] || ''}`}>{formatStatus(o.stage)}</span>
                  {o.container_number && <span className="text-muted" style={{ fontSize: '0.8125rem' }}>Container {o.container_number}</span>}
                </div>
                {o.expected_arrival_date && (
                  <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4, color: overdue ? 'var(--danger)' : undefined }}>
                    {overdue && <AlertTriangle size={12} />}
                    {overdue
                      ? `${Math.abs(eta)} days overdue`
                      : eta === 0 ? 'ETA today' : eta > 0 ? `ETA in ${eta} days` : 'Arrived'}
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="glass modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>New sourcing order</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input className="input" placeholder="Supplier / manufacturer name" required value={form.supplier_name}
                onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
              <input className="input" placeholder="Supplier country" value={form.supplier_country}
                onChange={(e) => setForm({ ...form, supplier_country: e.target.value })} />
              {machineModels.length > 0 && (
                <select className="input" value={form.machine_model_id} onChange={(e) => setForm({ ...form, machine_model_id: e.target.value })}>
                  <option value="">Machine model (optional)…</option>
                  {machineModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
              <select className="input" value={form.facility_id} onChange={(e) => setForm({ ...form, facility_id: e.target.value })}>
                <option value="">Destination facility (optional)…</option>
                {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {projects.length > 0 && (
                <select className="input" value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
                  <option value="">Linked project (optional)…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title} — {p.facility_name}</option>)}
                </select>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input className="input" type="number" min="1" placeholder="Quantity" value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })} style={{ flex: '1 1 100px' }} />
                <input className="input" type="number" step="0.01" placeholder="Total cost ($)" value={form.total_cost}
                  onChange={(e) => setForm({ ...form, total_cost: e.target.value })} style={{ flex: '1 1 160px' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem', flex: '1 1 160px' }} className="text-muted">
                  Order date
                  <input className="input" type="date" value={form.order_date}
                    onChange={(e) => setForm({ ...form, order_date: e.target.value })} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem', flex: '1 1 160px' }} className="text-muted">
                  Expected ship date
                  <input className="input" type="date" value={form.expected_ship_date}
                    onChange={(e) => setForm({ ...form, expected_ship_date: e.target.value })} />
                </label>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem' }} className="text-muted">
                Expected arrival date
                <input className="input" type="date" value={form.expected_arrival_date}
                  onChange={(e) => setForm({ ...form, expected_arrival_date: e.target.value })} />
              </label>
              <textarea className="input" placeholder="Notes" rows={3} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <button type="submit" className="btn" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Create sourcing order'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
