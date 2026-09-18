'use client'

import { useEffect, useState, use as usePromise } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Star } from 'lucide-react'
import { PROJECT_STATUSES } from '@/lib/constants'

const emptyContact = { name: '', title: '', email: '', phone: '', is_primary: false }
const emptyProject = { title: '', spec_summary: '', status: 'discovery', quote_value: '', target_date: '' }

function formatStatus(status) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function FacilityDetailPage({ params }) {
  const { id } = usePromise(params)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showContactForm, setShowContactForm] = useState(false)
  const [showProjectForm, setShowProjectForm] = useState(false)
  const [contactForm, setContactForm] = useState(emptyContact)
  const [projectForm, setProjectForm] = useState(emptyProject)

  const fetchData = () => {
    fetch(`/api/facilities/${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Failed to load facility'))))
      .then(setData)
      .catch((err) => console.error('Failed to load facility:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const addContact = async (e) => {
    e.preventDefault()
    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...contactForm, facility_id: id }),
    })
    setShowContactForm(false)
    setContactForm(emptyContact)
    fetchData()
  }

  const addProject = async (e) => {
    e.preventDefault()
    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...projectForm, facility_id: id }),
    })
    setShowProjectForm(false)
    setProjectForm(emptyProject)
    fetchData()
  }

  const updateProjectStatus = async (projectId, status) => {
    await fetch(`/api/projects/${projectId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data.projects.find((p) => p.id === projectId), status }),
    })
    fetchData()
  }

  const toggleActionItem = async (item) => {
    await fetch(`/api/action-items/${item.id}`, {
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
      </div>

      {facility.regulatory_notes && (
        <div className="glass glass-card" style={{ marginBottom: '2rem' }}>
          <h3>Regulatory / regional notes</h3>
          <p style={{ color: 'var(--foreground)', whiteSpace: 'pre-wrap' }}>{facility.regulatory_notes}</p>
        </div>
      )}

      <div className="grid-responsive-2">
        {/* Contacts */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Contacts</h3>
            <button className="btn btn-secondary" onClick={() => setShowContactForm((v) => !v)}>
              <Plus size={14} />
            </button>
          </div>

          {showContactForm && (
            <form onSubmit={addContact} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              <input className="input" placeholder="Name" required value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
              <input className="input" placeholder="Title" value={contactForm.title}
                onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} />
              <input className="input" placeholder="Email" value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
              <input className="input" placeholder="Phone" value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
                <input type="checkbox" checked={contactForm.is_primary}
                  onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })} />
                Primary contact
              </label>
              <button type="submit" className="btn">Add contact</button>
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

        {/* Projects */}
        <div className="glass glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0 }}>Projects</h3>
            <button className="btn btn-secondary" onClick={() => setShowProjectForm((v) => !v)}>
              <Plus size={14} />
            </button>
          </div>

          {showProjectForm && (
            <form onSubmit={addProject} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              <input className="input" placeholder="Project title (e.g. Line 3 ultrasonic cell)" required
                value={projectForm.title} onChange={(e) => setProjectForm({ ...projectForm, title: e.target.value })} />
              <textarea className="input" placeholder="Spec summary" rows={3} value={projectForm.spec_summary}
                onChange={(e) => setProjectForm({ ...projectForm, spec_summary: e.target.value })} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="input" type="number" placeholder="Quote value" value={projectForm.quote_value}
                  onChange={(e) => setProjectForm({ ...projectForm, quote_value: e.target.value })} style={{ flex: 1 }} />
                <input className="input" type="date" value={projectForm.target_date}
                  onChange={(e) => setProjectForm({ ...projectForm, target_date: e.target.value })} style={{ flex: 1 }} />
              </div>
              <button type="submit" className="btn">Add project</button>
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
