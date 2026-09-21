'use client'

import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { Wrench, Plus, X } from 'lucide-react'
import { MACHINE_STATUSES } from '@/lib/constants'
import { detergentPerFill } from '@/lib/consumption'
import { MachineSchema } from '@/lib/schemas'
import { submitJson } from '@/lib/formSubmit'
import MetricStrip from '../components/MetricStrip'
import ListSearch from '../components/ListSearch'
import VirtualList from '../components/VirtualList'
import LoadMore from '../components/LoadMore'
import { usePagedList } from '@/lib/usePagedList'
import FormError from '../components/FormError'
import { apiFetch } from '@/lib/apiFetch'

const emptyForm = {
  facility_id: '', machine_model_id: '', sourcing_order_id: '', serial_number: '', model: '', install_date: '', status: 'active',
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
  const [facilities, setFacilities] = useState([])
  const [products, setProducts] = useState([])
  const [machineModels, setMachineModels] = useState([])
  const [sourcingOrders, setSourcingOrders] = useState([])
  const [facilityFilter, setFacilityFilter] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  // The machine list is paged and searched server-side; the facility filter is
  // passed through so the two compose in SQL rather than fighting each other.
  const {
    items: machines, total, hasMore, loading, loadingMore, loadMore,
    query, setQuery, reload: reloadMachines,
  } = usePagedList({
    url: '/api/machines',
    key: 'machines',
    filters: { facility_id: facilityFilter },
  })
  const { register, handleSubmit, reset, setValue, control, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(MachineSchema),
    defaultValues: emptyForm,
  })
  // useWatch, not watch(): watch() re-renders the whole page on every keystroke
  // and the React Compiler cannot memoize it (react-hooks/incompatible-library).
  const tankCapacity = useWatch({ control, name: 'tank_capacity' })

  // Only the reference lists that feed the create form's selects. The machine
  // list itself is the hook's job.
  const fetchAll = () => {
    Promise.all([
      apiFetch('/api/facilities').then((r) => (r.ok ? r.json() : { facilities: [] })),
      apiFetch('/api/products').then((r) => (r.ok ? r.json() : { products: [] })),
      apiFetch('/api/machine-models').then((r) => (r.ok ? r.json() : { machine_models: [] })),
      apiFetch('/api/sourcing-orders').then((r) => (r.ok ? r.json() : { sourcing_orders: [] })),
    ])
      .then(([facData, prodData, modelsData, sourcingData]) => {
        setFacilities(facData.facilities || [])
        setProducts(prodData.products || [])
        setMachineModels(modelsData.machine_models || [])
        setSourcingOrders(sourcingData.sourcing_orders || [])
      })
      .catch((err) => console.error('Failed to load reference lists:', err))
  }

  // Picking a catalog model prefills tank size/fill cadence and the display
  // name — all still overridable per unit (e.g. a field-modified tank).
  const applyMachineModel = (machineModelId) => {
    const model = machineModels.find((m) => String(m.id) === machineModelId)
    if (!model) return
    setValue('model', model.name)
    setValue('tank_capacity', model.tank_capacity, { shouldValidate: true })
    if (model.fill_frequency_per_week != null) {
      setValue('fill_frequency_per_week', model.fill_frequency_per_week, { shouldValidate: true })
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const onSubmit = async (data) => {
    const result = await submitJson({
      url: '/api/machines',
      data,
      setError,
      fallback: 'Failed to create machine',
    })
    if (!result) return
    setIsModalOpen(false)
    reset(emptyForm)
    reloadMachines()
  }

  const closeModal = () => {
    setIsModalOpen(false)
    reset(emptyForm)
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

      <MetricStrip screen="machines" />

      <div className="input-group">
        <select className="input" value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}>
          <option value="">All facilities</option>
          {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      <ListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search model, serial or facility"
        showing={machines.length}
        total={total}
      />

      {loading ? (
        <div className="loader" />
      ) : machines.length === 0 ? (
        <div className="glass empty-state">
          {query
            ? <>No machine matches &ldquo;{query}&rdquo;.</>
            : 'No machines yet. Add one once a project is installed.'}
        </div>
      ) : (
        <>
          <VirtualList
            items={machines}
            getKey={(m) => m.id}
            minColumnWidth={200}
            estimateHeight={168}
            renderItem={(m) => (
              <Link href={`/machines/${m.id}`} className="glass glass-card interactive" style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%', marginBottom: 0 }}>
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
            )}
          />
          <LoadMore hasMore={hasMore} loading={loadingMore} onClick={loadMore} showing={machines.length} total={total} />
        </>
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Add machine</h2>
              <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="field">
                <select className={`input ${errors.facility_id ? 'input-invalid' : ''}`} {...register('facility_id')}>
                  <option value="">Facility…</option>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                <FormError error={errors.facility_id} />
              </div>
              {machineModels.length > 0 && (
                <select
                  className="input"
                  {...register('machine_model_id', { onChange: (e) => applyMachineModel(e.target.value) })}
                >
                  <option value="">Machine model (optional, prefills size)…</option>
                  {machineModels.map((m) => <option key={m.id} value={m.id}>{m.name} — {Number(m.tank_capacity).toLocaleString()} gal</option>)}
                </select>
              )}
              {sourcingOrders.length > 0 && (
                <select className="input" {...register('sourcing_order_id')}>
                  <option value="">Sourced from order (optional)…</option>
                  {sourcingOrders.map((o) => <option key={o.id} value={o.id}>{o.supplier_name} — {o.machine_model_name || 'build'}</option>)}
                </select>
              )}
              <input className="input" placeholder="Model / designation" {...register('model')} />
              <input className="input" placeholder="Serial number" {...register('serial_number')} />
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 150px' }}>
                  <input className={`input ${errors.install_date ? 'input-invalid' : ''}`} type="date" {...register('install_date')} />
                  <FormError error={errors.install_date} />
                </div>
                <select className="input" {...register('status')} style={{ flex: '1 1 130px' }}>
                  {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>
              </div>
              <select className="input" {...register('default_product_id')}>
                <option value="">Detergent used (optional)…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 160px' }}>
                  <input className={`input ${errors.tank_capacity ? 'input-invalid' : ''}`} type="number" step="any" placeholder="Tank capacity (gal)" {...register('tank_capacity')} />
                  <FormError error={errors.tank_capacity} />
                </div>
                <div className="field" style={{ flex: '1 1 160px' }}>
                  <input className={`input ${errors.fill_frequency_per_week ? 'input-invalid' : ''}`} type="number" step="any" placeholder="Fills per week" {...register('fill_frequency_per_week')} />
                  <FormError error={errors.fill_frequency_per_week} />
                </div>
              </div>
              {tankCapacity > 0 && (
                <p className="text-muted" style={{ fontSize: '0.8125rem', margin: 0 }}>
                  ~{detergentPerFill(tankCapacity)?.toLocaleString(undefined, { maximumFractionDigits: 1 })} gal detergent per fill (10%)
                </p>
              )}
              <textarea className="input" placeholder="Notes" rows={3} {...register('notes')} />
              <FormError error={errors.root} />
              <button type="submit" className="btn" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Add machine'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
