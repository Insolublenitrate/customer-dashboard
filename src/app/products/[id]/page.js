'use client'

import { useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, Package } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'
import { detergentPerFill } from '@/lib/consumption'
import HelpTip from '../../components/HelpTip'

function formatStatus(status) {
  return String(status).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ProductDetailPage({ params }) {
  const { id } = usePromise(params)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/api/products/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load product'))))
      .then(setData)
      .catch((err) => console.error('Failed to load product:', err))
      .finally(() => setLoading(false))
  }, [id])

  const back = (
    <Link
      href="/products"
      className="btn btn-secondary"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1.5rem', width: 'fit-content' }}
    >
      <ArrowLeft size={16} /> All products
    </Link>
  )

  if (loading) {
    return <main className="container"><div className="loader" /></main>
  }

  if (!data) {
    return (
      <main className="container">
        {back}
        <div className="glass empty-state">Couldn&apos;t find that product.</div>
      </main>
    )
  }

  // Defaulted rather than destructured bare: one missing list should cost its
  // own card, not the whole page.
  const { product, stock = [], machines = [], consumption_logs: logs = [] } = data

  const totalOnHand = stock.reduce((sum, s) => sum + Number(s.quantity_on_hand || 0), 0)
  const flagged = stock.filter((s) => s.flagged)
  const weeklyDraw = machines.reduce((sum, m) => {
    const perFill = detergentPerFill(m.tank_capacity)
    const freq = Number(m.fill_frequency_per_week)
    return sum + (perFill && freq ? perFill * freq : 0)
  }, 0)

  return (
    <main className="container">
      {back}

      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">{product.name}</h1>
          <p>
            {product.sku ? `SKU ${product.sku} · ` : ''}
            Sold by the {product.unit}
            {product.supplier_name ? ` · from ${product.supplier_name}` : ''}
          </p>
        </div>
      </div>

      <div className="metric-strip">
        <div className="metric-strip-item">
          <span className="metric-strip-label">On hand, all sites</span>
          <span className="metric-strip-value">
            {totalOnHand.toLocaleString(undefined, { maximumFractionDigits: 1 })}
          </span>
        </div>
        <div className="metric-strip-item">
          <span className="metric-strip-label">Sites stocking it</span>
          <span className="metric-strip-value">{stock.length}</span>
        </div>
        <div className="metric-strip-item">
          <span className="metric-strip-label">Needs reorder</span>
          <span
            className="metric-strip-value"
            style={{ color: flagged.length ? 'var(--warning)' : undefined }}
          >
            {flagged.length}
          </span>
        </div>
      </div>

      <div className="grid-responsive-2">
        {/* ------------------------------------------------------------ Details */}
        <div className="glass glass-card">
          <h3>Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.9375rem' }}>
            <div><span className="text-muted">Unit: </span>{product.unit}</div>
            <div>
              <span className="text-muted">Unit price: </span>
              {product.unit_price ? `$${Number(product.unit_price).toLocaleString()}` : '—'}
            </div>
            <div><span className="text-muted">Supplier: </span>{product.supplier_name || '—'}</div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="text-muted">Reorder lead time:&nbsp;</span>
              {product.reorder_lead_time_days} days
              <HelpTip
                label="What reorder lead time does"
                text="How long this takes to arrive after you order it. A site is flagged for reorder once its stock would run out sooner than this — so you are told while there is still time to order, not once it is already short."
              />
            </div>
            {weeklyDraw > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="text-muted">Planned weekly draw:&nbsp;</span>
                ~{weeklyDraw.toLocaleString(undefined, { maximumFractionDigits: 1 })} {product.unit}s
                <HelpTip
                  label="Where the planned weekly draw comes from"
                  text="Added up from the machines set to run on this product: every tank fill is 10% detergent, so a tank size times its fills per week gives the expected draw. It is what the forecast uses at a site that has machines but no logged usage yet."
                />
              </div>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------------- Stock */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Stock by facility</h3>
            <HelpTip
              label="How days left is worked out"
              text="Days left divides what is on hand by the daily burn rate. That rate comes from the last 60 days of logged usage where there is any, and from the machines' planned fill schedule where there is not — each row says which it used."
            />
          </div>
          {stock.length === 0 ? (
            <p className="text-muted">
              No facility is tracking stock of this product yet. Log a delivery on a facility
              page to start.
            </p>
          ) : (
            <div className="row-list">
              {stock.map((s) => (
                <div
                  key={s.id}
                  style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <Link href={`/facilities/${s.facility_id}`} style={{ color: 'var(--primary-hover)', fontWeight: 600 }}>
                      {s.facility_name}
                    </Link>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {Number(s.quantity_on_hand).toLocaleString(undefined, { maximumFractionDigits: 1 })} {s.unit}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.8125rem', marginTop: 2 }}>
                    {s.days_left === null
                      ? 'No burn rate yet — nothing logged and no machines on this product'
                      : `~${s.days_left} days left, from ${s.forecast_source}`}
                  </div>
                  {s.flagged && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--warning)', fontSize: '0.8125rem', marginTop: 4 }}>
                      <AlertTriangle size={14} />
                      Reorder — below threshold or inside the {product.reorder_lead_time_days}-day lead time
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ----------------------------------------------------------- Machines */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ margin: 0 }}>Machines running this</h3>
            <HelpTip
              label="What this list is"
              text="Machines whose detergent is set to this product. That link is what lets a site with no logged usage still be forecast, so a machine missing from here is a machine the forecast cannot see."
            />
          </div>
          {machines.length === 0 ? (
            <p className="text-muted">
              No machine is set to run on this product. Set it as the detergent on a machine to
              include it in demand planning.
            </p>
          ) : (
            <div className="row-list">
              {machines.map((m) => (
                <div key={m.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <Link href={`/machines/${m.id}`} style={{ color: 'var(--primary-hover)', fontWeight: 600 }}>
                      {m.model || 'Unnamed unit'}
                    </Link>
                    <span className="text-muted" style={{ fontSize: '0.8125rem' }}>{formatStatus(m.status)}</span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.8125rem' }}>
                    {m.facility_name}
                    {m.tank_capacity ? ` · ${Number(m.tank_capacity).toLocaleString()} gal tank` : ''}
                    {m.fill_frequency_per_week ? ` · ~${m.fill_frequency_per_week} fills/week` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- Recent */}
        <div className="glass glass-card">
          <h3>Recent movement</h3>
          {logs.length === 0 ? (
            <p className="text-muted">Nothing logged against this product yet.</p>
          ) : (
            <div className="row-list">
              {logs.map((log) => (
                <div key={log.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 8, fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>{formatStatus(log.type)} · {log.facility_name}</span>
                    <span style={{ color: Number(log.quantity) < 0 ? 'var(--warning)' : undefined, fontVariantNumeric: 'tabular-nums' }}>
                      {Number(log.quantity) > 0 ? '+' : ''}{log.quantity}
                    </span>
                  </div>
                  <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    {new Date(log.logged_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
