'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Trash2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { PO_STATUSES } from '@/lib/constants'

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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const fetchAll = () => {
    const params = new URLSearchParams()
    if (directionFilter) params.set('direction', directionFilter)

    Promise.all([
      fetch(`/api/purchase-orders?${params}`).then((r) => (r.ok ? r.json() : { purchase_orders: [] })),
      fetch('/api/facilities').then((r) => (r.ok ? r.json() : { facilities: [] })),
      fetch('/api/products').then((r) => (r.ok ? r.json() : { products: [] })),
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

  const updateItem = (index, patch) => {
    setForm((f) => ({ ...f, items: f.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) }))
  }

  const addItemRow = () => setForm((f) => ({ ...f, items: [...f.items, { ...emptyItem }] }))
  const removeItemRow = (index) => setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== index) }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, items: form.items.filter((i) => i.product_id || i.description) }),
      })
      if (!res.ok) throw new Error('Failed to create order')
      setIsModalOpen(false)
      setForm(emptyForm)
      fetchAll()
    } catch (err) {
      console.error(err)
      alert('Failed to create order')
    } finally {
      setIsSaving(false)
    }
  }

  const updateStatus = async (order, status) => {
    await fetch(`/api/purchase-orders/${order.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...order, status }),
    })
    fetchAll()
  }

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

      <div className="input-group">
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

      {loading ? (
        <div className="loader" />
      ) : orders.length === 0 ? (
        <div className="glass empty-state">No orders yet.</div>
      ) : (
        <div className="row-list">
          {orders.map((o) => (
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
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="glass modal-panel" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>New order</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="input-group" style={{ marginBottom: 0 }}>
                <button type="button" className={`btn ${form.direction === 'incoming' ? '' : 'btn-secondary'}`}
                  onClick={() => setForm({ ...form, direction: 'incoming' })} style={{ flex: 1 }}>
                  To customer
                </button>
                <button type="button" className={`btn ${form.direction === 'outgoing' ? '' : 'btn-secondary'}`}
                  onClick={() => setForm({ ...form, direction: 'outgoing' })} style={{ flex: 1 }}>
                  From supplier
                </button>
              </div>

              {form.direction === 'incoming' ? (
                <select className="input" required value={form.facility_id} onChange={(e) => setForm({ ...form, facility_id: e.target.value })}>
                  <option value="">Facility…</option>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              ) : (
                <input className="input" placeholder="Supplier name" required value={form.supplier_name}
                  onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input className="input" placeholder="PO # (optional)" value={form.po_number}
                  onChange={(e) => setForm({ ...form, po_number: e.target.value })} style={{ flex: '1 1 140px' }} />
                <input className="input" type="date" value={form.expected_date}
                  onChange={(e) => setForm({ ...form, expected_date: e.target.value })} style={{ flex: '1 1 140px' }} />
              </div>

              <div>
                <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: 6 }}>Line items</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {form.items.map((item, index) => (
                    <div key={index} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <select className="input" value={item.product_id}
                        onChange={(e) => updateItem(index, { product_id: e.target.value })} style={{ flex: 2 }}>
                        <option value="">Product…</option>
                        {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <input className="input" type="number" placeholder="Qty" value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
                      <input className="input" type="number" step="0.01" placeholder="$/unit" value={item.unit_price}
                        onChange={(e) => updateItem(index, { unit_price: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
                      <button type="button" onClick={() => removeItemRow(index)} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={addItemRow} className="btn btn-secondary" style={{ marginTop: 8 }}>
                  <Plus size={14} /> Add line
                </button>
              </div>

              <textarea className="input" placeholder="Notes" rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />

              <button type="submit" className="btn" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Create order'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
