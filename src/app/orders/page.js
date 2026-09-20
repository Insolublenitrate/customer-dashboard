'use client'

import { useEffect, useState } from 'react'
import { useForm, useFieldArray, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X, Trash2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { PO_STATUSES } from '@/lib/constants'
import { PurchaseOrderSchema } from '@/lib/schemas'
import { submitJson } from '@/lib/formSubmit'
import MetricStrip from '../components/MetricStrip'
import ListSearch from '../components/ListSearch'
import FormError from '../components/FormError'
import { apiFetch } from '@/lib/apiFetch'

const emptyItem = { product_id: '', description: '', quantity: 1, unit_price: '' }
const emptyForm = {
  direction: 'incoming', facility_id: '', supplier_name: '', status: 'draft',
  po_number: '', expected_date: '', notes: '', items: [{ ...emptyItem }],
}

function formatStatus(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const STATUS_BADGE = {
  draft: '',
  submitted: 'badge-warning',
  confirmed: 'badge-warning',
  shipped: '',
  fulfilled: 'badge-success',
  cancelled: 'badge-danger',
}

export default function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [facilities, setFacilities] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [directionFilter, setDirectionFilter] = useState('')
  const [query, setQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { register, handleSubmit, reset, control, setValue, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(PurchaseOrderSchema),
    defaultValues: emptyForm,
  })
  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({ control, name: 'items' })
  // Which party the order names depends on this, so the form watches it.
  const direction = useWatch({ control, name: 'direction' })

  const fetchAll = () => {
    const params = new URLSearchParams()
    if (directionFilter) params.set('direction', directionFilter)

    Promise.all([
      apiFetch(`/api/purchase-orders?${params}`).then((r) => (r.ok ? r.json() : { purchase_orders: [] })),
      apiFetch('/api/facilities').then((r) => (r.ok ? r.json() : { facilities: [] })),
      apiFetch('/api/products').then((r) => (r.ok ? r.json() : { products: [] })),
    ])
      .then(([ordersData, facData, prodData]) => {
        setOrders(ordersData.purchase_orders || [])
        setFacilities(facData.facilities || [])
        setProducts(prodData.products || [])
      })
      .catch((err) => console.error('Failed to load orders:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directionFilter])

  // Switching direction clears the field the other direction owns, so a value
  // typed under one branch cannot be submitted under the other.
  const setDirection = (next) => {
    setValue('direction', next)
    setValue(next === 'incoming' ? 'supplier_name' : 'facility_id', '')
  }

  const onSubmit = async (data) => {
    const result = await submitJson({
      url: '/api/purchase-orders',
      // A blank line row is a leftover, not an order line.
      data: { ...data, items: data.items.filter((i) => i.product_id || i.description) },
      setError,
      fallback: 'Failed to create order',
    })
    if (!result) return
    setIsModalOpen(false)
    reset(emptyForm)
    fetchAll()
  }

  const closeModal = () => {
    setIsModalOpen(false)
    reset(emptyForm)
  }

  const updateStatus = async (order, status) => {
    await apiFetch(`/api/purchase-orders/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...order, status }),
    })
    fetchAll()
  }

  const q = query.trim().toLowerCase()
  const visibleOrders = q
    ? orders.filter((o) =>
        [o.po_number, o.facility_name, o.supplier_name, o.status]
          .some((v) => v && String(v).toLowerCase().includes(q)))
    : orders

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Orders</h1>
          <p>Detergent and parts orders — what you buy from suppliers, and what you ship to the customer.</p>
        </div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          New order
        </button>
      </div>

      <MetricStrip screen="orders" />

      <div className="filter-row">
        {[
          { value: '', label: 'All' },
          { value: 'incoming', label: 'To customer' },
          { value: 'outgoing', label: 'From supplier' },
        ].map((opt) => (
          <button
            key={opt.value}
            className={`btn ${directionFilter === opt.value ? '' : 'btn-secondary'}`}
            onClick={() => setDirectionFilter(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <ListSearch
        value={query}
        onChange={setQuery}
        placeholder="Search PO number, facility or supplier"
        showing={visibleOrders.length}
        total={orders.length}
      />

      {loading ? (
        <div className="loader" />
      ) : visibleOrders.length === 0 && orders.length > 0 ? (
        <div className="glass empty-state">No order matches &ldquo;{query}&rdquo;.</div>
      ) : orders.length === 0 ? (
        <div className="glass empty-state">No orders yet.</div>
      ) : (
        <div className="row-list">
          {visibleOrders.map((o) => (
            <div key={o.id} className="glass row-card" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {o.direction === 'incoming' ? (
                    <ArrowDownToLine size={16} color="var(--success)" />
                  ) : (
                    <ArrowUpFromLine size={16} color="var(--accent)" />
                  )}
                  <strong>{o.direction === 'incoming' ? (o.facility_name || 'Customer order') : (o.supplier_name || 'Supplier order')}</strong>
                  {o.po_number && <span className="text-muted" style={{ fontSize: '0.8125rem' }}>#{o.po_number}</span>}
                </div>
                <select
                  className="input"
                  value={o.status}
                  onChange={(e) => updateStatus(o, e.target.value)}
                  style={{ minWidth: 0, padding: '0.35rem 0.5rem', fontSize: '0.75rem', width: 'auto' }}
                >
                  {PO_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>
              </div>
              <div className="text-muted" style={{ fontSize: '0.8125rem', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span className={`badge ${STATUS_BADGE[o.status] || ''}`}>{formatStatus(o.status)}</span>
                <span>{o.item_count} item{o.item_count === '1' ? '' : 's'}</span>
                {o.total_value && <span>${Number(o.total_value).toLocaleString()}</span>}
                {o.expected_date && <span>Expected {new Date(o.expected_date).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>New order</h2>
              <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <button type="button" className={`btn ${direction === 'incoming' ? '' : 'btn-secondary'}`}
                  onClick={() => setDirection('incoming')} style={{ flex: 1 }}>
                  To customer
                </button>
                <button type="button" className={`btn ${direction === 'outgoing' ? '' : 'btn-secondary'}`}
                  onClick={() => setDirection('outgoing')} style={{ flex: 1 }}>
                  From supplier
                </button>
              </div>
              <input type="hidden" {...register('direction')} />

              {direction === 'incoming' ? (
                <div className="field">
                  <select className={`input ${errors.facility_id ? 'input-invalid' : ''}`} {...register('facility_id')}>
                    <option value="">Facility…</option>
                    {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <FormError error={errors.facility_id} />
                </div>
              ) : (
                <div className="field">
                  <input className={`input ${errors.supplier_name ? 'input-invalid' : ''}`} placeholder="Supplier name" {...register('supplier_name')} />
                  <FormError error={errors.supplier_name} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="input" placeholder="PO # (optional)" {...register('po_number')} style={{ flex: '1 1 140px' }} />
                <div className="field" style={{ flex: '1 1 140px' }}>
                  <input className={`input ${errors.expected_date ? 'input-invalid' : ''}`} type="date" {...register('expected_date')} />
                  <FormError error={errors.expected_date} />
                </div>
              </div>

              <div>
                <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: 6 }}>Line items</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {itemFields.map((item, index) => (
                    <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <select className="input" {...register(`items.${index}.product_id`)} style={{ flex: 2 }}>
                        <option value="">Product…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input className="input" type="number" placeholder="Qty" {...register(`items.${index}.quantity`)} style={{ flex: 1, minWidth: 0 }} />
                      <input className="input" type="number" step="0.01" placeholder="$/unit" {...register(`items.${index}.unit_price`)} style={{ flex: 1, minWidth: 0 }} />
                      <button type="button" onClick={() => removeItem(index)} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => appendItem({ ...emptyItem })} className="btn btn-secondary" style={{ marginTop: 8 }}>
                  <Plus size={14} /> Add line
                </button>
              </div>

              <textarea className="input" placeholder="Notes" rows={2} {...register('notes')} />

              <FormError error={errors.root} />
              <button type="submit" className="btn" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Create order'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
