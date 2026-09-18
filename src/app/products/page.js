'use client'

import { useEffect, useState } from 'react'
import { Package, Plus, X } from 'lucide-react'

const emptyForm = { name: '', sku: '', unit: 'gallon', unit_price: '', supplier_name: '', reorder_lead_time_days: 14 }

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const fetchProducts = () => {
    fetch('/api/products')
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => setProducts(data.products || []))
      .catch((err) => console.error('Failed to load products:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to create product')
      setIsModalOpen(false)
      setForm(emptyForm)
      fetchProducts()
    } catch (err) {
      console.error(err)
      alert('Failed to create product')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Products</h1>
          <p>The consumable/parts catalog — detergent SKUs and what they cost.</p>
        </div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Add product
        </button>
      </div>

      {loading ? (
        <div className="loader" />
      ) : products.length === 0 ? (
        <div className="glass empty-state">No products yet. Add a detergent SKU to start tracking stock.</div>
      ) : (
        <div className="metrics-grid">
          {products.map((p) => (
            <div key={p.id} className="glass glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Package size={18} color="var(--primary-hover)" />
                <h3 style={{ margin: 0 }}>{p.name}</h3>
              </div>
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                {p.sku ? `SKU ${p.sku} · ` : ''}{p.unit}
                {p.unit_price ? ` · $${Number(p.unit_price).toLocaleString()}/unit` : ''}
              </p>
              {p.supplier_name && <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: 4 }}>Supplier: {p.supplier_name}</p>}
              <p className="text-muted" style={{ fontSize: '0.75rem', marginTop: 4 }}>{p.reorder_lead_time_days}-day reorder lead time</p>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <form onSubmit={handleSubmit} className="glass modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Add product</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input className="input" placeholder="Name (e.g. UltraClean 40 Detergent)" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="SKU (optional)" value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input className="input" placeholder="Unit (e.g. gallon, drum)" value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })} style={{ flex: '1 1 120px' }} />
                <input className="input" type="number" step="0.01" placeholder="Unit price ($)" value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })} style={{ flex: '1 1 120px' }} />
              </div>
              <input className="input" placeholder="Supplier name" value={form.supplier_name}
                onChange={(e) => setForm({ ...form, supplier_name: e.target.value })} />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem' }} className="text-muted">
                Reorder lead time (days)
                <input className="input" type="number" value={form.reorder_lead_time_days}
                  onChange={(e) => setForm({ ...form, reorder_lead_time_days: e.target.value })} />
              </label>
              <button type="submit" className="btn" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Add product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
