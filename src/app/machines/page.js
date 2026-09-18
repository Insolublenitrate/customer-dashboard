'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Wrench, Plus, X } from 'lucide-react'
import { MACHINE_STATUSES } from '@/lib/constants'
import { detergentPerFill } from '@/lib/consumption'

const emptyForm = {
  facility_id: '', machine_model_id: '', serial_number: '', model: '', install_date: '', status: 'active',
  default_product_id: '', tank_capacity: '', fill_frequency_per_week: '', notes: '',
}

function formatStatus(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const STATUS_BADGE = {
  active: 'badge-success',
  needs_service: 'badge-warning',
  offline: 'badge-danger',
  decommissioned: '',
}

export default function MachinesPage() {
  const [machines, setMachines] = useState([])
  const [facilities, setFacilities] = useState([])
  const [products, setProducts] = useState([])
  const [machineModels, setMachineModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [facilityFilter, setFacilityFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const fetchAll = () => {
    const params = new URLSearchParams()
    if (facilityFilter) params.set('facility_id', facilityFilter)

    Promise.all([
      fetch(`/api/machines?${params}`).then((r) => (r.ok ? r.json() : { machines: [] })),
      fetch('/api/facilities').then((r) => (r.ok ? r.json() : { facilities: [] })),
      fetch('/api/products').then((r) => (r.ok ? r.json() : { products: [] })),
      fetch('/api/machine-models').then((r) => (r.ok ? r.json() : { machine_models: [] })),
    ])
      .then(([machinesData, facData, prodData, modelsData]) => {
        setMachines(machinesData.machines || [])
        setFacilities(facData.facilities || [])
        setProducts(prodData.products || [])
        setMachineModels(modelsData.machine_models || [])
      })
      .catch((err) => console.error('Failed to load machines:', err))
      .finally(() => setLoading(false))
  }

  // Picking a catalog model prefills tank size/fill cadence and the display
  // name — all still overridable per unit (e.g. a field-modified tank).
  const applyMachineModel = (machineModelId) => {
    const model = machineModels.find((m) => String(m.id) === machineModelId)
    setForm((f) => ({
      ...f,
      machine_model_id: machineModelId,
      model: model ? model.name : f.model,
      tank_capacity: model ? model.tank_capacity : f.tank_capacity,
      fill_frequency_per_week: model?.fill_frequency_per_week ?? f.fill_frequency_per_week,
    }))
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facilityFilter])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch('/api/machines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to create machine')
      setIsModalOpen(false)
      setForm(emptyForm)
      fetchAll()
    } catch (err) {
      console.error(err)
      alert('Failed to create machine')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Machines</h1>
          <p>Every installed unit across all facilities.</p>
        </div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Add machine
        </button>
      </div>

      <div className="input-group">
        <select className="input" value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}>
          <option value="">All facilities</option>
          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loader" />
      ) : machines.length === 0 ? (
        <div className="glass empty-state">No machines yet. Add one once a project is installed.</div>
      ) : (
        <div className="metrics-grid">
          {machines.map((m) => (
            <Link key={m.id} href={`/machines/${m.id}`} className="glass glass-card interactive" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Wrench size={18} color="var(--primary-hover)" />
                <h3 style={{ margin: 0 }}>{m.model || 'Unnamed unit'}</h3>
              </div>
              <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: 12 }}>
                {m.facility_name}{m.serial_number ? ` · SN ${m.serial_number}` : ''}
              </p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`badge ${STATUS_BADGE[m.status] || ''}`}>{formatStatus(m.status)}</span>
                {m.default_product_name && <span className="text-muted" style={{ fontSize: '0.8125rem' }}>{m.default_product_name}</span>}
              </div>
              {(m.tank_capacity || m.fill_frequency_per_week) && (
                <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: 8 }}>
                  {m.tank_capacity ? `${Number(m.tank_capacity).toLocaleString()} gal tank` : ''}
                  {m.tank_capacity && m.fill_frequency_per_week ? ' · ' : ''}
                  {m.fill_frequency_per_week ? `~${m.fill_frequency_per_week} fills/wk` : ''}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="glass modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Add machine</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <select className="input" required value={form.facility_id} onChange={(e) => setForm({ ...form, facility_id: e.target.value })}>
                <option value="">Facility…</option>
                {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {machineModels.length > 0 && (
                <select className="input" value={form.machine_model_id} onChange={(e) => applyMachineModel(e.target.value)}>
                  <option value="">Machine model (optional, prefills size)…</option>
                  {machineModels.map((m) => <option key={m.id} value={m.id}>{m.name} — {Number(m.tank_capacity).toLocaleString()} gal</option>)}
                </select>
              )}
              <input className="input" placeholder="Model / designation" value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })} />
              <input className="input" placeholder="Serial number" value={form.serial_number}
                onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input className="input" type="date" value={form.install_date}
                  onChange={(e) => setForm({ ...form, install_date: e.target.value })} style={{ flex: '1 1 150px' }} />
                <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ flex: '1 1 130px' }}>
                  {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>
              </div>
              <select className="input" value={form.default_product_id} onChange={(e) => setForm({ ...form, default_product_id: e.target.value })}>
                <option value="">Detergent used (optional)…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input className="input" type="number" step="any" placeholder="Tank capacity (gal)" value={form.tank_capacity}
                  onChange={(e) => setForm({ ...form, tank_capacity: e.target.value })} style={{ flex: '1 1 160px' }} />
                <input className="input" type="number" step="any" placeholder="Fills per week" value={form.fill_frequency_per_week}
                  onChange={(e) => setForm({ ...form, fill_frequency_per_week: e.target.value })} style={{ flex: '1 1 160px' }} />
              </div>
              {form.tank_capacity > 0 && (
                <p className="text-muted" style={{ fontSize: '0.8125rem', margin: 0 }}>
                  ~{detergentPerFill(form.tank_capacity)?.toLocaleString(undefined, { maximumFractionDigits: 1 })} gal detergent per fill (10%)
                </p>
              )}
              <textarea className="input" placeholder="Notes" rows={3} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <button type="submit" className="btn" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Add machine'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
