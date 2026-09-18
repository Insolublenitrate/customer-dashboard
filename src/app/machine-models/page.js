'use client'

import { useEffect, useState } from 'react'
import { Boxes, Plus, X } from 'lucide-react'
import { detergentPerFill } from '@/lib/consumption'

const emptyForm = { name: '', tank_capacity: '', fill_frequency_per_week: '', notes: '' }

export default function MachineModelsPage() {
  const [machineModels, setMachineModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const fetchMachineModels = () => {
    fetch('/api/machine-models')
      .then((res) => (res.ok ? res.json() : { machine_models: [] }))
      .then((data) => setMachineModels(data.machine_models || []))
      .catch((err) => console.error('Failed to load machine models:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMachineModels()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch('/api/machine-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to create machine model')
      setIsModalOpen(false)
      setForm(emptyForm)
      fetchMachineModels()
    } catch (err) {
      console.error(err)
      alert('Failed to create machine model')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Machine models</h1>
          <p>The size/model catalog — tank capacity and expected fill cadence per unit type.</p>
        </div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Add model
        </button>
      </div>

      {loading ? (
        <div className="loader" />
      ) : machineModels.length === 0 ? (
        <div className="glass empty-state">No machine models yet. Add one to reuse across every unit of that size.</div>
      ) : (
        <div className="metrics-grid">
          {machineModels.map((m) => {
            const perFill = detergentPerFill(m.tank_capacity)
            return (
              <div key={m.id} className="glass glass-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Boxes size={18} color="var(--primary-hover)" />
                  <h3 style={{ margin: 0 }}>{m.name}</h3>
                </div>
                <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                  {Number(m.tank_capacity).toLocaleString()} gal tank
                  {m.fill_frequency_per_week ? ` · ~${m.fill_frequency_per_week} fills/week` : ''}
                </p>
                {perFill !== null && (
                  <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: 4 }}>
                    ~{perFill.toLocaleString(undefined, { maximumFractionDigits: 1 })} gal detergent per fill (10%)
                  </p>
                )}
                {m.notes && <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: 4 }}>{m.notes}</p>}
              </div>
            )
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="glass modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Add machine model</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input className="input" placeholder="Name (e.g. US-1200XL)" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input className="input" type="number" step="any" placeholder="Tank capacity (gal)" required value={form.tank_capacity}
                  onChange={(e) => setForm({ ...form, tank_capacity: e.target.value })} style={{ flex: '1 1 160px' }} />
                <input className="input" type="number" step="any" placeholder="Typical fills/week" value={form.fill_frequency_per_week}
                  onChange={(e) => setForm({ ...form, fill_frequency_per_week: e.target.value })} style={{ flex: '1 1 160px' }} />
              </div>
              <textarea className="input" placeholder="Notes" rows={3} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <button type="submit" className="btn" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Add model'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
