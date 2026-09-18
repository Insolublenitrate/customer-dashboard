'use client'

import { useEffect, useState, use as usePromise } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { ArrowLeft, Plus, Star, Wrench, AlertTriangle } from 'lucide-react'
import { PROJECT_STATUSES, MACHINE_STATUSES } from '@/lib/constants'
import { ContactSchema, ProjectSchema, MachineSchema, ConsumptionLogSchema } from '@/lib/schemas'
import { submitJson } from '@/lib/formSubmit'
import MetricStrip from '../../components/MetricStrip'
import DraftButton from '../../components/DraftButton'
import FormError from '../../components/FormError'
import { apiFetch } from '@/lib/apiFetch'

const emptyContact = { name: '', title: '', email: '', phone: '', is_primary: false }
const emptyProject = { title: '', spec_summary: '', status: 'discovery', quote_value: '', target_date: '' }
const emptyMachine = { machine_model_id: '', serial_number: '', model: '', install_date: '', status: 'active', default_product_id: '', tank_capacity: '', fill_frequency_per_week: '' }
const emptyLog = { product_id: '', type: 'usage', quantity: '', notes: '' }

function formatStatus(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function FacilityDetailPage({ params }) {
  const { id } = usePromise(params)
  const [data, setData] = useState(null)
  const [stockData, setStockData] = useState(null)
  const [machines, setMachines] = useState([])
  const [products, setProducts] = useState([])
  const [machineModels, setMachineModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [showContactForm, setShowContactForm] = useState(false)
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [showMachineForm, setShowMachineForm] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)
  // Four independent forms on one screen, so four independent useForm
  // instances — a shared one would let a bad contact block a machine.
  const contact = useForm({ resolver: zodResolver(ContactSchema), defaultValues: { ...emptyContact, facility_id: id } })
  const project = useForm({ resolver: zodResolver(ProjectSchema), defaultValues: { ...emptyProject, facility_id: id } })
  const machine = useForm({ resolver: zodResolver(MachineSchema), defaultValues: { ...emptyMachine, facility_id: id } })
  const log = useForm({ resolver: zodResolver(ConsumptionLogSchema), defaultValues: emptyLog })

  const fetchData = () => {
    Promise.all([
      apiFetch(`/api/facilities/${id}`).then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load facility')))),
      apiFetch(`/api/facilities/${id}/stock`).then((res) => (res.ok ? res.json() : { stock: [], consumption_logs: [] })),
      apiFetch(`/api/machines?facility_id=${id}`).then((res) => (res.ok ? res.json() : { machines: [] })),
      apiFetch('/api/products').then((res) => (res.ok ? res.json() : { products: [] })),
      apiFetch('/api/machine-models').then((res) => (res.ok ? res.json() : { machine_models: [] })),
    ])
      .then(([facilityData, stock, machinesData, productsData, machineModelsData]) => {
        setData(facilityData)
        setStockData(stock)
        setMachines(machinesData.machines || [])
        setProducts(productsData.products || [])
        setMachineModels(machineModelsData.machine_models || [])
      })
      .catch((err) => console.error('Failed to load facility:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const applyMachineModel = (machineModelId) => {
    const model = machineModels.find((m) => String(m.id) === machineModelId)
    if (!model) return
    machine.setValue('model', model.name)
    machine.setValue('tank_capacity', model.tank_capacity, { shouldValidate: true })
    if (model.fill_frequency_per_week != null) {
      machine.setValue('fill_frequency_per_week', model.fill_frequency_per_week, { shouldValidate: true })
    }
  }

  // Each of these used to fire-and-forget: no res.ok check, so a rejected POST
  // still closed the form and refetched, and the row simply never appeared.
  const addMachine = machine.handleSubmit(async (data) => {
    const result = await submitJson({
      url: '/api/machines', data, setError: machine.setError, fallback: 'Failed to add machine',
    })
    if (!result) return
    setShowMachineForm(false)
    machine.reset({ ...emptyMachine, facility_id: id })
    fetchData()
  })

  const logConsumption = log.handleSubmit(async (data) => {
    const result = await submitJson({
      url: `/api/facilities/${id}/stock`, data, setError: log.setError, fallback: 'Failed to log entry',
    })
    if (!result) return
    setShowLogForm(false)
    log.reset(emptyLog)
    fetchData()
  })

  const addContact = contact.handleSubmit(async (data) => {
    const result = await submitJson({
      url: '/api/contacts', data, setError: contact.setError, fallback: 'Failed to add contact',
    })
    if (!result) return
    setShowContactForm(false)
    contact.reset({ ...emptyContact, facility_id: id })
    fetchData()
  })

  const addProject = project.handleSubmit(async (data) => {
    const result = await submitJson({
      url: '/api/projects', data, setError: project.setError, fallback: 'Failed to add project',
    })
    if (!result) return
    setShowProjectForm(false)
    project.reset({ ...emptyProject, facility_id: id })
    fetchData()
  })

  const updateProjectStatus = async (projectId, status) => {
    await apiFetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(data.projects || []).find((p) => p.id === projectId), status }),
    })
    fetchData()
  }

  const toggleActionItem = async (item) => {
    await apiFetch(`/api/action-items/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: item.status === 'open' ? 'done' : 'open' }),
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
        <Link href="/facilities" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1.5rem', width: 'fit-content' }}>
          <ArrowLeft size={16} /> All facilities
        </Link>
        <div className="glass empty-state">Couldn&apos;t find that facility.</div>
      </main>
    )
  }

  const { facility, contacts, projects, communications, action_items: actionItems } = data

  return (
    <main className="container">
      <Link href="/facilities" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1.5rem', width: 'fit-content' }}>
        <ArrowLeft size={16} /> All facilities
      </Link>

      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">
            {facility.name}{' '}
            {facility.is_mother_location && <span className="badge">Mother location</span>}
          </h1>
          <p style={{ color: 'var(--muted)' }}>
            {[facility.address, facility.city, facility.state, facility.zip].filter(Boolean).join(', ') || 'No address on file'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <DraftButton kind="facility_checkin" contextId={id} label="Draft check-in" />
          <DraftButton kind="reorder_proposal" contextId={id} label="Draft reorder" />
        </div>
      </div>

      <MetricStrip screen="facility" facilityId={id} />

      {facility.regulatory_notes && (
        <div className="glass glass-card" style={{ marginBottom: '2rem' }}>
          <h3>Regulatory / regional notes</h3>
          <p style={{ color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>{facility.regulatory_notes}</p>
        </div>
      )}

      <div className="grid-responsive-2">
        {/* Action items */}
        <div className="glass glass-card">
          <h3>Action items</h3>
          {actionItems.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>Nothing outstanding.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {actionItems.map((item) => (
                <label key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, opacity: item.status === 'done' ? 0.5 : 1 }}>
                  <input type="checkbox" checked={item.status === 'done'} onChange={() => toggleActionItem(item)} style={{ marginTop: 4 }} />
                  <span style={{ textDecoration: item.status === 'done' ? 'line-through' : 'none' }}>
                    {item.description}
                    {item.owner && <span style={{ color: 'var(--muted)' }}> — {item.owner}</span>}
                    {item.due_date && <span style={{ color: 'var(--muted)' }}> (due {new Date(item.due_date).toLocaleDateString()})</span>}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Consumable stock */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Consumable stock</h3>
            <button className="btn btn-secondary" onClick={() => setShowLogForm((v) => !v)}>
              <Plus size={14} />
            </button>
          </div>

          {showLogForm && (
            <form onSubmit={logConsumption} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              <div className="field">
                <select className={`input ${log.formState.errors.product_id ? 'input-invalid' : ''}`} {...log.register('product_id')}>
                  <option value="">Product…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <FormError error={log.formState.errors.product_id} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <select className="input" {...log.register('type')} style={{ flex: 1 }}>
                  <option value="usage">Usage</option>
                  <option value="delivery">Delivery</option>
                  <option value="adjustment">Adjustment (set total)</option>
                </select>
                <div className="field" style={{ flex: 1 }}>
                  <input className={`input ${log.formState.errors.quantity ? 'input-invalid' : ''}`} type="number" step="any" placeholder="Quantity" {...log.register('quantity')} />
                  <FormError error={log.formState.errors.quantity} />
                </div>
              </div>
              <FormError error={log.formState.errors.root} />
              <button type="submit" className="btn" disabled={log.formState.isSubmitting}>Log entry</button>
            </form>
          )}

          {!products.length ? (
            <p className="text-muted">Add a product in the Products catalog first.</p>
          ) : !stockData?.stock?.length ? (
            <p className="text-muted">No stock tracked yet. Log a delivery to start.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {stockData.stock.map((s) => (
                <div key={s.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{s.product_name}</strong>
                    <span>{s.quantity_on_hand} {s.product_unit}</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.8125rem', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {s.days_left !== null
                      ? `~${s.days_left} days left (from ${s.forecast_source})`
                      : 'Not enough data to forecast — log usage or set fill cadence on machines'}
                    {s.flagged && (
                      <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={11} /> Reorder soon
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid-responsive-2" style={{ marginTop: '2rem' }}>
        {/* Machines at this site */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Machines at this site</h3>
            <button className="btn btn-secondary" onClick={() => setShowMachineForm((v) => !v)}>
              <Plus size={14} />
            </button>
          </div>

          {showMachineForm && (
            <form onSubmit={addMachine} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              {machineModels.length > 0 && (
                <select className="input" {...machine.register('machine_model_id', { onChange: (e) => applyMachineModel(e.target.value) })}>
                  <option value="">Machine model (optional, prefills size)…</option>
                  {machineModels.map((m) => <option key={m.id} value={m.id}>{m.name} — {Number(m.tank_capacity).toLocaleString()} gal</option>)}
                </select>
              )}
              <input className="input" placeholder="Model / designation" {...machine.register('model')} />
              <input className="input" placeholder="Serial number" {...machine.register('serial_number')} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 140px' }}>
                  <input className={`input ${machine.formState.errors.install_date ? 'input-invalid' : ''}`} type="date" {...machine.register('install_date')} />
                  <FormError error={machine.formState.errors.install_date} />
                </div>
                <select className="input" {...machine.register('status')} style={{ flex: '1 1 120px' }}>
                  {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>
              </div>
              <select className="input" {...machine.register('default_product_id')}>
                <option value="">Detergent used (optional)…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 140px' }}>
                  <input className={`input ${machine.formState.errors.tank_capacity ? 'input-invalid' : ''}`} type="number" step="any" placeholder="Tank capacity (gal)" {...machine.register('tank_capacity')} />
                  <FormError error={machine.formState.errors.tank_capacity} />
                </div>
                <div className="field" style={{ flex: '1 1 140px' }}>
                  <input className={`input ${machine.formState.errors.fill_frequency_per_week ? 'input-invalid' : ''}`} type="number" step="any" placeholder="Fills per week" {...machine.register('fill_frequency_per_week')} />
                  <FormError error={machine.formState.errors.fill_frequency_per_week} />
                </div>
              </div>
              <FormError error={machine.formState.errors.root} />
              <button type="submit" className="btn" disabled={machine.formState.isSubmitting}>Add machine</button>
            </form>
          )}

          {machines.length === 0 ? (
            <p className="text-muted">No machines installed here yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {machines.map((m) => (
                <Link key={m.id} href={`/machines/${m.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit', borderBottom: '1px solid var(--border)', paddingBottom: 8, flexWrap: 'wrap' }}>
                  <Wrench size={15} color="var(--primary-hover)" />
                  <strong>{m.model || 'Unnamed unit'}</strong>
                  {m.serial_number && <span className="text-muted" style={{ fontSize: '0.8125rem' }}>SN {m.serial_number}</span>}
                  {m.tank_capacity && <span className="text-muted" style={{ fontSize: '0.8125rem' }}>{Number(m.tank_capacity).toLocaleString()} gal</span>}
                  <span className="badge" style={{ marginLeft: 'auto' }}>{formatStatus(m.status)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Projects */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Projects</h3>
            <button className="btn btn-secondary" onClick={() => setShowProjectForm((v) => !v)}>
              <Plus size={14} />
            </button>
          </div>

          {showProjectForm && (
            <form onSubmit={addProject} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              <div className="field">
                <input className={`input ${project.formState.errors.title ? 'input-invalid' : ''}`} placeholder="Project title (e.g. Line 3 ultrasonic cell)" {...project.register('title')} />
                <FormError error={project.formState.errors.title} />
              </div>
              <textarea className="input" placeholder="Spec summary" rows={3} {...project.register('spec_summary')} />
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="field" style={{ flex: 1 }}>
                  <input className={`input ${project.formState.errors.quote_value ? 'input-invalid' : ''}`} type="number" placeholder="Quote value" {...project.register('quote_value')} />
                  <FormError error={project.formState.errors.quote_value} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <input className={`input ${project.formState.errors.target_date ? 'input-invalid' : ''}`} type="date" {...project.register('target_date')} />
                  <FormError error={project.formState.errors.target_date} />
                </div>
              </div>
              <FormError error={project.formState.errors.root} />
              <button type="submit" className="btn" disabled={project.formState.isSubmitting}>Add project</button>
            </form>
          )}

          {projects.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No projects yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {projects.map((p) => (
                <div key={p.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{p.title}</strong>
                    <select className="input" value={p.status} style={{ minWidth: 0, padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                      onChange={(e) => updateProjectStatus(p.id, e.target.value)}>
                      {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
                    </select>
                  </div>
                  {p.spec_summary && <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: 4 }}>{p.spec_summary}</p>}
                  {(p.quote_value || p.target_date) && (
                    <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 4 }}>
                      {p.quote_value && <span>${Number(p.quote_value).toLocaleString()}</span>}
                      {p.quote_value && p.target_date && ' · '}
                      {p.target_date && <span>Target {new Date(p.target_date).toLocaleDateString()}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid-responsive-2" style={{ marginTop: '2rem' }}>
        {/* Contacts */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Contacts</h3>
            <button className="btn btn-secondary" onClick={() => setShowContactForm((v) => !v)}>
              <Plus size={14} />
            </button>
          </div>

          {showContactForm && (
            <form onSubmit={addContact} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              <div className="field">
                <input className={`input ${contact.formState.errors.name ? 'input-invalid' : ''}`} placeholder="Name" {...contact.register('name')} />
                <FormError error={contact.formState.errors.name} />
              </div>
              <input className="input" placeholder="Title" {...contact.register('title')} />
              <div className="field">
                <input className={`input ${contact.formState.errors.email ? 'input-invalid' : ''}`} placeholder="Email" {...contact.register('email')} />
                <FormError error={contact.formState.errors.email} />
              </div>
              <input className="input" placeholder="Phone" {...contact.register('phone')} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
                <input type="checkbox" {...contact.register('is_primary')} />
                Primary contact
              </label>
              <FormError error={contact.formState.errors.root} />
              <button type="submit" className="btn" disabled={contact.formState.isSubmitting}>Add contact</button>
            </form>
          )}

          {contacts.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>No contacts yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {contacts.map((c) => (
                <div key={c.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.is_primary && <Star size={14} color="var(--warning)" fill="var(--warning)" />}
                    <strong>{c.name}</strong>
                    {c.title && <span style={{ color: 'var(--muted)' }}>— {c.title}</span>}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
                    {[c.email, c.phone].filter(Boolean).join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent communications */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Recent communications</h3>
            <Link href="/communications" className="btn btn-secondary">Upload</Link>
          </div>
          {communications.length === 0 ? (
            <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>Nothing uploaded for this facility yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: '1rem' }}>
              {communications.map((c) => (
                <div key={c.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="badge">{formatStatus(c.type)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                      {new Date(c.occurred_at || c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginTop: 4 }}>{c.ai_summary || c.source_filename || 'Processing…'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </main>
  )
}
