'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Users, DollarSign, HelpCircle } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

const CATEGORY = {
  sales_opportunity: { label: 'Opportunity', icon: TrendingUp, color: 'var(--success)' },
  operational_risk: { label: 'Risk', icon: AlertTriangle, color: 'var(--danger)' },
  relationship: { label: 'Relationship', icon: Users, color: 'var(--accent)' },
  commercial: { label: 'Commercial', icon: DollarSign, color: 'var(--primary-hover)' },
  data_gap: { label: 'Data gap', icon: HelpCircle, color: 'var(--muted)' },
}

const PRIORITY_BADGE = { high: 'badge-danger', medium: 'badge-warning', low: '' }

export default function Briefing() {
  const [briefing, setBriefing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch('/api/briefing')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load briefing'))))
      .then((data) => setBriefing(data.briefing))
      .catch((err) => console.error('Failed to load briefing:', err))
      .finally(() => setLoading(false))
  }, [])

  const generate = async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await apiFetch('/api/briefing', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate briefing')
      setBriefing(data.briefing)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return null

  return (
    <div className="glass glass-card" style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: briefing ? '1rem' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={16} color="var(--primary-hover)" />
          <h3 style={{ margin: 0 }}>What the numbers are saying</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {briefing && (
            <span className="text-muted" style={{ fontSize: '0.75rem' }}>
              {new Date(briefing.generated_at).toLocaleString()}
            </span>
          )}
          <button className="btn btn-secondary" onClick={generate} disabled={generating}>
            <RefreshCw size={14} className={generating ? 'spin' : undefined} />
            {generating ? 'Reading the account…' : briefing ? 'Refresh' : 'Run analysis'}
          </button>
        </div>
      </div>

      {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}

      {!briefing && !error && (
        <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>
          Claude reads the whole account — machines, stock, pipeline, shipments and contact history — and reports
          what stands out. This takes a few seconds and costs an API call, so it runs when you ask rather than on
          every visit.
        </p>
      )}

      {briefing && (
        <>
          <p style={{ fontSize: '1rem', lineHeight: 1.55, marginBottom: '1.25rem' }}>{briefing.headline}</p>

          <div className="row-list">
            {briefing.findings.map((finding, index) => {
              const meta = CATEGORY[finding.category] || CATEGORY.commercial
              const Icon = meta.icon
              return (
                <div
                  key={index}
                  style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.85rem' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <Icon size={15} color={meta.color} />
                    <strong style={{ flex: 1, minWidth: 0 }}>{finding.title}</strong>
                    <span className={`badge ${PRIORITY_BADGE[finding.priority] || ''}`} style={{ fontSize: '0.6875rem' }}>
                      {meta.label}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.875rem', lineHeight: 1.5, marginBottom: 8 }}>{finding.detail}</p>

                  <p className="text-muted" style={{ fontSize: '0.8125rem', marginBottom: 8 }}>
                    <strong style={{ color: 'var(--muted)' }}>Based on: </strong>{finding.evidence}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--primary-hover)', fontWeight: 600 }}>
                      Do next:
                    </span>
                    <span style={{ fontSize: '0.8125rem' }}>{finding.recommended_action}</span>
                    {finding.facility_id && (
                      <Link href={`/facilities/${finding.facility_id}`} style={{ fontSize: '0.8125rem', color: 'var(--primary-hover)' }}>
                        Open facility →
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
