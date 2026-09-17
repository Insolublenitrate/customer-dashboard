'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Plus, X } from 'lucide-react'

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY',
]

const emptyForm = {
  name: '', is_mother_location: false, address: '', city: '', state: '', zip: '', region: '', regulatory_notes: '',
}

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [isSaving, setIsSaving] = useState(false)

  const fetchFacilities = () => {
    fetch('/api/facilities')
      .then((res) => res.json())
      .then((data) => setFacilities(data.facilities || []))
      .catch((err) => console.error('Failed to load facilities:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchFacilities()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    try {
      const res = await fetch('/api/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to create facility')
      setIsModalOpen(false)
      setForm(emptyForm)
      fetchFacilities()
    } catch (err) {
      console.error(err)
      alert('Failed to create facility')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Facilities</h1>
          <p style={{ color: '#94a3b8' }}>Every site for this account, mother location first.</p>
        </div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Add facility
        </button>
      </div>

      {loading ? (
        <div className="loader" />
      ) : facilities.length === 0 ? (
        <div className="glass glass-card">No facilities yet. Add the first one to get started.</div>
      ) : (
        <div className="metrics-grid">
          {facilities.map((f) => (
            <Link key={f.id} href={`/facilities/${f.id}`} className="glass glass-card" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Building2 size={18} color="#60a5fa" />
                <h3 style={{ margin: 0 }}>{f.name}</h3>
                {f.is_mother_location && <span className="badge">Mother location</span>}
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 12 }}>
                {[f.city, f.state].filter(Boolean).join(', ') || 'No location on file'}
              </p>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.875rem' }}>
                <span>{f.active_project_count} active project{f.active_project_count === '1' ? '' : 's'}</span>
                <span>{f.open_action_item_count} open item{f.open_action_item_count === '1' ? '' : 's'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 50 }}>
          <form onSubmit={handleSubmit} className="glass glass-card" style={{ width: '100%', maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Add facility</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.4rem' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input className="input" placeholder="Facility name" required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
                <input type="checkbox" checked={form.is_mother_location}
                  onChange={(e) => setForm({ ...form, is_mother_location: e.target.checked })} />
                This is the mother/HQ location
              </label>
              <input className="input" placeholder="Address" value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input className="input" placeholder="City" value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ flex: 1 }} />
                <select className="input" value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ flex: 1 }}>
                  <option value="">State</option>
                  {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="input" placeholder="Zip" value={form.zip}
                  onChange={(e) => setForm({ ...form, zip: e.target.value })} style={{ width: 100 }} />
              </div>
              <textarea className="input" placeholder="Regulatory notes (regional codes, requirements, etc.)"
                rows={3} value={form.regulatory_notes}
                onChange={(e) => setForm({ ...form, regulatory_notes: e.target.value })} />
              <button type="submit" className="btn" disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Add facility'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
