'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Package, Plus, X } from 'lucide-react'
import { ProductSchema } from '@/lib/schemas'
import { submitJson } from '@/lib/formSubmit'
import MetricStrip from '../components/MetricStrip'
import FormError from '../components/FormError'

const emptyForm = { name: '', sku: '', unit: 'gallon', unit_price: '', supplier_name: '', reorder_lead_time_days: 14 }

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(ProductSchema),
    defaultValues: emptyForm,
  })

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

  const onSubmit = async (data) => {
    const result = await submitJson({
      url: '/api/products',
      data,
      setError,
      fallback: 'Failed to create product',
    })
    if (!result) return
    setIsModalOpen(false)
    reset(emptyForm)
    fetchProducts()
  }

  const closeModal = () => {
    setIsModalOpen(false)
    reset(emptyForm)
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

      <MetricStrip screen="products" />

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
        <div className="modal-backdrop" onClick={closeModal}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass modal-panel" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Add product</h2>
              <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="field">
                <input className={`input ${errors.name ? 'input-invalid' : ''}`} placeholder="Name (e.g. UltraClean 40 Detergent)" {...register('name')} />
                <FormError error={errors.name} />
              </div>
              <input className="input" placeholder="SKU (optional)" {...register('sku')} />
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <input className="input" placeholder="Unit (e.g. gallon, drum)" {...register('unit')} style={{ flex: '1 1 120px' }} />
                <div className="field" style={{ flex: '1 1 120px' }}>
                  <input className={`input ${errors.unit_price ? 'input-invalid' : ''}`} type="number" step="0.01" placeholder="Unit price ($)" {...register('unit_price')} />
                  <FormError error={errors.unit_price} />
                </div>
              </div>
              <input className="input" placeholder="Supplier name" {...register('supplier_name')} />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem' }} className="text-muted">
                Reorder lead time (days)
                <input className={`input ${errors.reorder_lead_time_days ? 'input-invalid' : ''}`} type="number" {...register('reorder_lead_time_days')} />
              </label>
              <FormError error={errors.reorder_lead_time_days} />
              <FormError error={errors.root} />
              <button type="submit" className="btn" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Add product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
