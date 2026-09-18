'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, FileText, Mail, Phone, File as FileIcon, Download } from 'lucide-react'
import { COMMUNICATION_TYPES } from '@/lib/constants'

const TYPE_ICON = {
  meeting_minutes: FileText,
  email: Mail,
  call_note: Phone,
  other: FileIcon,
}

function formatType(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function CommunicationsPage() {
  const [communications, setCommunications] = useState([])
  const [facilities, setFacilities] = useState([])
  const [loading, setLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pastedText, setPastedText] = useState('')
  const [selectedType, setSelectedType] = useState('meeting_minutes')
  const [selectedFacility, setSelectedFacility] = useState('')
  const fileInputRef = useRef(null)

  const fetchAll = () => {
    Promise.all([
      fetch('/api/communications').then((r) => r.json()),
      fetch('/api/facilities').then((r) => r.json()),
    ])
      .then(([commsData, facData]) => {
        setCommunications(commsData.communications || [])
        setFacilities(facData.facilities || [])
      })
      .catch((err) => console.error('Failed to load communications:', err))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const uploadFile = async (file) => {
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', selectedType)
      if (selectedFacility) formData.append('facility_id', selectedFacility)

      const res = await fetch('/api/communications/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      fetchAll()
    } catch (err) {
      console.error(err)
      alert('Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const submitPastedText = async (e) => {
    e.preventDefault()
    if (!pastedText.trim()) return
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('text', pastedText)
      formData.append('type', selectedType)
      if (selectedFacility) formData.append('facility_id', selectedFacility)

      const res = await fetch('/api/communications/upload', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('Upload failed')
      setPastedText('')
      fetchAll()
    } catch (err) {
      console.error(err)
      alert('Failed to process text')
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const linkFacility = async (commId, facilityId) => {
    await fetch(`/api/communications/${commId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ facility_id: facilityId }),
    })
    fetchAll()
  }

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Communications</h1>
          <p style={{ color: 'var(--muted)' }}>Upload meeting minutes and emails — Claude summarizes them and pulls out action items.</p>
        </div>
      </div>

      <div className="glass glass-card" style={{ marginBottom: '2rem' }}>
        <div className="input-group" style={{ marginBottom: '1rem' }}>
          <select className="input" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            {COMMUNICATION_TYPES.map((t) => <option key={t} value={t}>{formatType(t)}</option>)}
          </select>
          <select className="input" value={selectedFacility} onChange={(e) => setSelectedFacility(e.target.value)}>
            <option value="">Auto-detect facility</option>
            {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--border)'}`,
            borderRadius: '0.75rem',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: '1rem',
          }}
        >
          <Upload size={24} style={{ marginBottom: 8, opacity: 0.7 }} />
          <p>{isUploading ? 'Processing…' : 'Drag a file here, or click to choose one'}</p>
          <p style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>.txt, .md, .vtt, .srt, .docx, .pdf, .eml</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.vtt,.srt,.docx,.pdf,.eml"
            style={{ display: 'none' }}
            onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = '' }}
          />
        </div>

        <form onSubmit={submitPastedText} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <textarea
            className="input"
            rows={4}
            placeholder="…or paste an email or notes here"
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
          />
          <button type="submit" className="btn" disabled={isUploading || !pastedText.trim()} style={{ alignSelf: 'flex-start' }}>
            {isUploading ? 'Processing…' : 'Process text'}
          </button>
        </form>
      </div>

      {loading ? (
        <div className="loader" />
      ) : communications.length === 0 ? (
        <div className="glass glass-card">Nothing uploaded yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {communications.map((c) => {
            const Icon = TYPE_ICON[c.type] || FileIcon
            return (
              <div key={c.id} className="glass glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Icon size={18} color="var(--primary-hover)" style={{ marginTop: 3 }} />
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className="badge">{formatType(c.type)}</span>
                        {c.source_filename && <span style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>{c.source_filename}</span>}
                        <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                          {new Date(c.occurred_at || c.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p style={{ marginTop: 8 }}>{c.ai_summary || 'Summary unavailable.'}</p>
                      {Number(c.action_item_count) > 0 && (
                        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: 4 }}>
                          {c.action_item_count} action item{c.action_item_count === '1' ? '' : 's'} extracted
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                    {c.storage_url && (
                      <a href={`/api/communications/${c.id}/file`} className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }}>
                        <Download size={14} />
                      </a>
                    )}
                    {c.facility_name ? (
                      <span className="badge">{c.facility_name}</span>
                    ) : (
                      <select
                        className="input"
                        style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                        defaultValue=""
                        onChange={(e) => e.target.value && linkFacility(c.id, e.target.value)}
                      >
                        <option value="" disabled>Link to facility…</option>
                        {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                      </select>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
