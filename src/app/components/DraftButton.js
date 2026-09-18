'use client'

import { useState } from 'react'
import { PenLine, X, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react'

// Drop next to whatever the draft is about — the context comes from the
// record, so the owner never re-types facts the app already holds.
export default function DraftButton({ kind, contextId, label = 'Draft message' }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(null)
  const [instruction, setInstruction] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  const generate = async (nudge) => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, context_id: contextId, instruction: nudge || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not write that draft.')
      setDraft(data.draft)
      setInstruction('')
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setPending(false)
    }
  }

  const openAndGenerate = () => {
    setOpen(true)
    if (!draft) generate()
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Clipboard write failed:', err)
      setError('Could not copy — select the text and copy manually.')
    }
  }

  return (
    <>
      <button className="btn btn-secondary" onClick={openAndGenerate}>
        <PenLine size={14} />
        {label}
      </button>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="glass modal-panel" style={{ maxWidth: 620 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{label}</h2>
              <button onClick={() => setOpen(false)} className="btn btn-secondary" style={{ padding: '0.5rem', minHeight: 'auto' }}>
                <X size={16} />
              </button>
            </div>

            {pending && (
              <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '1rem 0' }}>
                <span className="loader" style={{ width: 16, height: 16, margin: 0, borderWidth: 2 }} />
                Writing…
              </div>
            )}

            {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>}

            {draft && !pending && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>Subject</span>
                  <p style={{ fontWeight: 600 }}>{draft.subject}</p>
                </div>

                <div
                  style={{
                    whiteSpace: 'pre-wrap', lineHeight: 1.55, fontSize: '0.9375rem',
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)', padding: '0.85rem', maxHeight: '40vh', overflowY: 'auto',
                  }}
                >
                  {draft.body}
                </div>

                {draft.placeholders?.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.8125rem', color: 'var(--warning)' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>Fill these in before sending: {draft.placeholders.join(', ')}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    placeholder="Change something — firmer, shorter, mention…"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && instruction.trim()) generate(instruction) }}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-secondary" onClick={() => generate(instruction)} disabled={pending} style={{ flexShrink: 0 }}>
                    <RefreshCw size={14} />
                  </button>
                </div>

                <button className="btn" onClick={copy}>
                  {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
