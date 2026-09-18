'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles } from 'lucide-react'
import { apiFetch } from '@/lib/apiFetch'

const SUGGESTIONS = [
  'Which facility is slipping?',
  'What machines arrive in the next month?',
  "What's still open at Phoenix?",
  'Which sites should I be selling more detergent to?',
]

export default function AskPage() {
  const [turns, setTurns] = useState([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [turns, pending])

  const ask = async (text) => {
    const trimmed = text.trim()
    if (!trimmed || pending) return

    const history = turns.filter((t) => !t.failed)
    setTurns((prev) => [...prev, { role: 'user', content: trimmed }])
    setQuestion('')
    setPending(true)

    try {
      const res = await apiFetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, history }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not answer that one.')
      setTurns((prev) => [...prev, { role: 'assistant', content: data.answer }])
    } catch (err) {
      console.error(err)
      setTurns((prev) => [...prev, { role: 'assistant', content: err.message, failed: true }])
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Ask</h1>
          <p>Questions about the account, answered from the live data.</p>
        </div>
      </div>

      {turns.length === 0 && (
        <div className="glass glass-card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Sparkles size={16} color="var(--primary-hover)" />
            <strong>Try one of these</strong>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="btn btn-secondary"
                // .btn is nowrap, which sends a long suggestion out past the card edge.
                style={{ fontSize: '0.8125rem', whiteSpace: 'normal', textAlign: 'left', maxWidth: '100%' }}
                onClick={() => ask(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: 12 }}>
            Claude can look up action items, communications, orders, consumption history and shipments to answer.
            It will tell you when the data doesn&apos;t cover something rather than guessing.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        {turns.map((turn, index) => (
          <div
            key={index}
            className={turn.role === 'assistant' ? 'glass glass-card' : undefined}
            style={
              turn.role === 'user'
                ? {
                    alignSelf: 'flex-end', maxWidth: '85%', padding: '0.7rem 0.95rem',
                    borderRadius: 'var(--radius-md)', background: 'var(--primary)', color: '#fff',
                  }
                : { whiteSpace: 'pre-wrap', lineHeight: 1.55, color: turn.failed ? 'var(--danger)' : undefined }
            }
          >
            {turn.content}
          </div>
        ))}

        {pending && (
          <div className="glass glass-card text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="loader" style={{ width: 16, height: 16, margin: 0, borderWidth: 2 }} />
            Reading the account…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(question) }}
        style={{ display: 'flex', gap: 8, position: 'sticky', bottom: 0, paddingBottom: '0.5rem' }}
      >
        <input
          className="input"
          placeholder="Ask about facilities, stock, orders, shipments…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn" disabled={pending || !question.trim()} style={{ flexShrink: 0 }}>
          <Send size={16} />
        </button>
      </form>
    </main>
  )
}
