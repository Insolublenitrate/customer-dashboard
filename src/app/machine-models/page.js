'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Boxes, Plus, X } from 'lucide-react'
import { detergentPerFill } from '@/lib/consumption'
import { MachineModelSchema } from '@/lib/schemas'
import { submitJson } from '@/lib/formSubmit'
import MetricStrip from '../components/MetricStrip'
import FormError from '../components/FormError'
import { apiFetch } from '@/lib/apiFetch'

const emptyForm = { name: '', tank_capacity: '', fill_frequency_per_week: '', notes: '' }

export default function MachineModelsPage() {
  const [machineModels, setMachineModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(MachineModelSchema),
    defaultValues: emptyForm,
  })

  const fetchMachineModels = () => {
    apiFetch('/api/machine-models')
      .then((res) => (res.ok ? res.json() : { machine_models: [] }))
      .then((data) => setMachineModels(data.machine_models || []))
      .catch((err) => console.error('Failed to load machine models:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMachineModels()
  }, [])

  const onSubmit = async (data) => {
    const result = await submitJson({
      url: '/api/machine-models',
      data,
      setError,
      fallback: 'Failed to create machine model',
    })
    if (!result) return
    setIsModalOpen(false)
    reset(emptyForm)
    fetchMachineModels()
  }

  const closeModal = () => {
    setIsModalOpen(false)
    reset(emptyForm)
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

      <MetricStrip screen="machine-models" />

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
        <div className="modal-backdrop" onClick={closeModal}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Add machine model</h2>
              <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="field">
                <input className={`input ${errors.name ? 'input-invalid' : ''}`} placeholder="Name (e.g. US-1200XL)" {...register('name')} />
                <FormError error={errors.name} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 160px' }}>
                  <input className={`input ${errors.tank_capacity ? 'input-invalid' : ''}`} type="number" step="any" placeholder="Tank capacity (gal)" {...register('tank_capacity')} />
                  <FormError error={errors.tank_capacity} />
                </div>
                <div className="field" style={{ flex: '1 1 160px' }}>
                  <input className={`input ${errors.fill_frequency_per_week ? 'input-invalid' : ''}`} type="number" step="any" placeholder="Typical fills/week" {...register('fill_frequency_per_week')} />
                  <FormError error={errors.fill_frequency_per_week} />
                </div>
              </div>
              <textarea className="input" placeholder="Notes" rows={3} {...register('notes')} />
              <FormError error={errors.root} />
              <button type="submit" className="btn" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Add model'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
