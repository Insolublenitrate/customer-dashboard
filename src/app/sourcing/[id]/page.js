'use client'

import { useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Ship } from 'lucide-react'
import { SOURCING_STAGES } from '@/lib/constants'
import { formatStatus } from '@/lib/format'
import DraftButton from '../../components/DraftButton'

const editableFields = [
  'supplier_name', 'supplier_country', 'quantity', 'order_date', 'deposit_amount', 'deposit_paid_date',
  'total_cost', 'expected_ship_date', 'actual_ship_date', 'expected_arrival_date', 'actual_arrival_date',
  'container_number', 'vessel_name', 'carrier', 'port_of_origin', 'port_of_destination', 'tracking_url', 'notes',
]

function toFormState(order) {
  const form = {}
  for (const key of editableFields) form[key] = order[key] ?? ''
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

const DATE_FIELDS = new Set(['order_date', 'deposit_paid_date', 'expected_ship_date', 'actual_ship_date', 'expected_arrival_date', 'actual_arrival_date'])
const MONEY_FIELDS = new Set(['deposit_amount', 'total_cost'])

export default function SourcingOrderDetailPage({ params }) {
  const { id } = usePromise(params)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

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
    setForm(toFormState(data.sourcing_order))
    setIsEditing(true)
  }

  const saveEdits = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      await fetch(`/api/sourcing-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data.sourcing_order, ...form }),
      })
      setIsEditing(false)
      fetchData()
    } catch (err) {
      console.error(err)
      alert('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
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
            <form onSubmit={saveEdits} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="input" placeholder="Supplier name" required value={form.supplier_name}
                  onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} style={{ flex: '1 1 160px' }} />
                <input className="input" placeholder="Country" value={form.supplier_country}
                  onChange={(e) => setForm({ ...form, supplier_country: e.target.value })} style={{ flex: '1 1 120px' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="input" type="number" min="1" placeholder="Quantity" value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })} style={{ flex: '1 1 100px' }} />
                <input className="input" type="number" step="0.01" placeholder="Total cost ($)" value={form.total_cost}
                  onChange={(e) => setForm({ ...form, total_cost: e.target.value })} style={{ flex: '1 1 140px' }} />
                <input className="input" type="number" step="0.01" placeholder="Deposit ($)" value={form.deposit_amount}
                  onChange={(e) => setForm({ ...form, deposit_amount: e.target.value })} style={{ flex: '1 1 140px' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  ['order_date', 'Order date'], ['deposit_paid_date', 'Deposit paid'],
                  ['expected_ship_date', 'Expected ship'], ['actual_ship_date', 'Actual ship'],
                  ['expected_arrival_date', 'Expected arrival'], ['actual_arrival_date', 'Actual arrival'],
                ].map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', flex: '1 1 150px' }} className="text-muted">
                    {label}
                    <input className="input" type="date" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  </label>
                ))}
              </div>
              <p className="text-muted" style={{ fontSize: '0.8125rem', margin: '4px 0 0' }}>Shipment</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="input" placeholder="Container #" value={form.container_number}
                  onChange={(e) => setForm({ ...form, container_number: e.target.value })} style={{ flex: '1 1 140px' }} />
                <input className="input" placeholder="Vessel" value={form.vessel_name}
                  onChange={(e) => setForm({ ...form, vessel_name: e.target.value })} style={{ flex: '1 1 140px' }} />
                <input className="input" placeholder="Carrier" value={form.carrier}
                  onChange={(e) => setForm({ ...form, carrier: e.target.value })} style={{ flex: '1 1 140px' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="input" placeholder="Port of origin" value={form.port_of_origin}
                  onChange={(e) => setForm({ ...form, port_of_origin: e.target.value })} style={{ flex: '1 1 140px' }} />
                <input className="input" placeholder="Port of destination" value={form.port_of_destination}
                  onChange={(e) => setForm({ ...form, port_of_destination: e.target.value })} style={{ flex: '1 1 140px' }} />
              </div>
              <input className="input" placeholder="Tracking link" value={form.tracking_url}
                onChange={(e) => setForm({ ...form, tracking_url: e.target.value })} />
              <textarea className="input" placeholder="Notes" rows={3} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <button type="submit" className="btn" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save'}</button>
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
