'use client'

import { useEffect, useState, use as usePromise } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { ArrowLeft, Pencil, Ship } from 'lucide-react'
import { SOURCING_STAGES } from '@/lib/constants'
import { formatStatus } from '@/lib/format'
import { SourcingOrderSchema } from '@/lib/schemas'
import { submitJson } from '@/lib/formSubmit'
import DraftButton from '../../components/DraftButton'
import FormError from '../../components/FormError'

const editableFields = [
  'supplier_name', 'supplier_country', 'quantity', 'order_date', 'deposit_amount', 'deposit_paid_date',
  'total_cost', 'expected_ship_date', 'actual_ship_date', 'expected_arrival_date', 'actual_arrival_date',
  'container_number', 'vessel_name', 'carrier', 'port_of_origin', 'port_of_destination', 'tracking_url', 'notes',
]

const DATE_FIELDS = new Set(['order_date', 'deposit_paid_date', 'expected_ship_date', 'actual_ship_date', 'expected_arrival_date', 'actual_arrival_date'])

// Postgres hands dates back as ISO timestamps ("2026-05-02T00:00:00.000Z"),
// which <input type="date"> cannot display — it renders blank. Every date on
// this order looked unset the moment you opened the edit form.
function toDateInput(value) {
  if (!value) return ''
  const s = String(value)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : s.slice(0, 10)
}

function toFormState(order) {
  const form = {}
  for (const key of editableFields) {
    form[key] = DATE_FIELDS.has(key) ? toDateInput(order[key]) : (order[key] ?? '')
  }
  return form
}

const FIELD_LABELS = {
  supplier_country: 'Country',
  deposit_amount: 'Deposit',
  deposit_paid_date: 'Deposit paid',
  total_cost: 'Total cost',
  order_date: 'Order date',
  expected_ship_date: 'Expected ship',
  actual_ship_date: 'Actual ship',
  expected_arrival_date: 'Expected arrival',
  actual_arrival_date: 'Actual arrival',
  container_number: 'Container #',
  vessel_name: 'Vessel',
  carrier: 'Carrier',
  port_of_origin: 'Port of origin',
  port_of_destination: 'Port of destination',
  tracking_url: 'Tracking link',
}

const MONEY_FIELDS = new Set(['deposit_amount', 'total_cost'])

export default function SourcingOrderDetailPage({ params }) {
  const { id } = usePromise(params)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(SourcingOrderSchema),
  })

  const fetchData = () => {
    fetch(`/api/sourcing-orders/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load sourcing order'))))
      .then(setData)
      .catch((err) => console.error('Failed to load sourcing order:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const updateStage = async (stage) => {
    await fetch(`/api/sourcing-orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data.sourcing_order, stage }),
    })
    fetchData()
  }

  const startEditing = () => {
    reset(toFormState(data.sourcing_order))
    setIsEditing(true)
  }

  const saveEdits = handleSubmit(async (values) => {
    const result = await submitJson({
      url: `/api/sourcing-orders/${id}`,
      method: 'PUT',
      // The PUT writes every column, and parsing fills in schema fields this
      // form has no input for — stage, facility_id — as nulls. Merging only the
      // editable keys keeps those from overwriting the row with defaults.
      data: {
        ...data.sourcing_order,
        ...Object.fromEntries(editableFields.map((k) => [k, values[k]])),
      },
      setError,
      fallback: 'Failed to save changes',
    })
    if (!result) return
    setIsEditing(false)
    fetchData()
  })

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
        <Link href="/sourcing" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1.5rem', width: 'fit-content' }}>
          <ArrowLeft size={16} /> All sourcing orders
        </Link>
        <div className="glass empty-state">Couldn&apos;t find that sourcing order.</div>
      </main>
    )
  }

  const { sourcing_order: order, events, machines } = data
  const currentIndex = SOURCING_STAGES.indexOf(order.stage)

  return (
    <main className="container">
      <Link href="/sourcing" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1.5rem', width: 'fit-content' }}>
        <ArrowLeft size={16} /> All sourcing orders
      </Link>

      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">{order.supplier_name}</h1>
          <p>
            {order.machine_model_name || 'Machine build'}{order.quantity > 1 ? ` × ${order.quantity}` : ''}
            {order.facility_name && (
              <> · <Link href={`/facilities/${order.facility_id}`} style={{ color: 'var(--primary-hover)' }}>{order.facility_name}</Link></>
            )}
            {order.project_title && <> · {order.project_title}</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <DraftButton kind="supplier_chase" contextId={id} label="Chase supplier" />
          <select className="input" value={order.stage} onChange={(e) => updateStage(e.target.value)} style={{ width: 'auto' }}>
            {SOURCING_STAGES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
          </select>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="glass glass-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
          {SOURCING_STAGES.map((s, i) => (
            <div key={s} style={{ flex: '1 1 100px', minWidth: 90, textAlign: 'center' }}>
              <div
                style={{
                  height: 6, borderRadius: 999, margin: '0 2px 8px',
                  background: i <= currentIndex ? 'var(--primary)' : 'var(--border)',
                }}
              />
              <span
                className={i === currentIndex ? undefined : 'text-muted'}
                style={{ fontSize: '0.6875rem', fontWeight: i === currentIndex ? 700 : 400 }}
              >
                {formatStatus(s)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid-responsive-2">
        <div className="glass glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Order & shipment details</h3>
            <button className="btn btn-secondary" onClick={isEditing ? () => setIsEditing(false) : startEditing}>
              <Pencil size={14} />
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={saveEdits} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 160px' }}>
                  <input className={`input ${errors.supplier_name ? 'input-invalid' : ''}`} placeholder="Supplier name" {...register('supplier_name')} />
                  <FormError error={errors.supplier_name} />
                </div>
                <input className="input" placeholder="Country" {...register('supplier_country')} style={{ flex: '1 1 120px' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div className="field" style={{ flex: '1 1 100px' }}>
                  <input className={`input ${errors.quantity ? 'input-invalid' : ''}`} type="number" min="1" placeholder="Quantity" {...register('quantity')} />
                  <FormError error={errors.quantity} />
                </div>
                <div className="field" style={{ flex: '1 1 140px' }}>
                  <input className={`input ${errors.total_cost ? 'input-invalid' : ''}`} type="number" step="0.01" placeholder="Total cost ($)" {...register('total_cost')} />
                  <FormError error={errors.total_cost} />
                </div>
                <div className="field" style={{ flex: '1 1 140px' }}>
                  <input className={`input ${errors.deposit_amount ? 'input-invalid' : ''}`} type="number" step="0.01" placeholder="Deposit ($)" {...register('deposit_amount')} />
                  <FormError error={errors.deposit_amount} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  ['order_date', 'Order date'], ['deposit_paid_date', 'Deposit paid'],
                  ['expected_ship_date', 'Expected ship'], ['actual_ship_date', 'Actual ship'],
                  ['expected_arrival_date', 'Expected arrival'], ['actual_arrival_date', 'Actual arrival'],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', flex: '1 1 150px' }} className="text-muted">
                    {label}
                    <input className={`input ${errors[key] ? 'input-invalid' : ''}`} type="date" {...register(key)} />
                    <FormError error={errors[key]} />
                  </label>
                ))}
              </div>
              <p className="text-muted" style={{ fontSize: '0.8125rem', margin: '4px 0 0' }}>Shipment</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="input" placeholder="Container #" {...register('container_number')} style={{ flex: '1 1 140px' }} />
                <input className="input" placeholder="Vessel" {...register('vessel_name')} style={{ flex: '1 1 140px' }} />
                <input className="input" placeholder="Carrier" {...register('carrier')} style={{ flex: '1 1 140px' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="input" placeholder="Port of origin" {...register('port_of_origin')} style={{ flex: '1 1 140px' }} />
                <input className="input" placeholder="Port of destination" {...register('port_of_destination')} style={{ flex: '1 1 140px' }} />
              </div>
              <input className="input" placeholder="Tracking link" {...register('tracking_url')} />
              <textarea className="input" placeholder="Notes" rows={3} {...register('notes')} />
              <FormError error={errors.root} />
              <button type="submit" className="btn" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</button>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.9375rem' }}>
              {editableFields.filter((k) => order[k] !== null && order[k] !== '').length === 0 ? (
                <p className="text-muted">No details filled in yet.</p>
              ) : (
                editableFields.map((key) => {
                  if (order[key] === null || order[key] === '') return null
                  const label = FIELD_LABELS[key]
                  if (!label) return null
                  let value = order[key]
                  if (DATE_FIELDS.has(key)) value = new Date(value).toLocaleDateString()
                  if (MONEY_FIELDS.has(key)) value = `$${Number(value).toLocaleString()}`
                  if (key === 'tracking_url') {
                    return (
                      <div key={key}><span className="text-muted">{label}: </span>
                        <a href={value} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-hover)' }}>{value}</a>
                      </div>
                    )
                  }
                  return <div key={key}><span className="text-muted">{label}: </span>{value}</div>
                })
              )}
              {order.notes && (
                <div style={{ marginTop: 8 }}>
                  <span className="text-muted">Notes</span>
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{order.notes}</p>
                </div>
              )}
              {machines.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <span className="text-muted">Installed as</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    {machines.map((m) => (
                      <Link key={m.id} href={`/machines/${m.id}`} style={{ color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Ship size={13} /> {m.model || `Machine #${m.id}`}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="glass glass-card">
          <h3>Progress timeline</h3>
          {events.length === 0 ? (
            <p className="text-muted">No history yet.</p>
          ) : (
            <div className="row-list">
              {events.map((ev) => (
                <div key={ev.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>{formatStatus(ev.stage)}</strong>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>{new Date(ev.occurred_at).toLocaleDateString()}</span>
                  </div>
                  {ev.notes && <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: 2 }}>{ev.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
