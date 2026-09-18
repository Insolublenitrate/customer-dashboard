'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    const { error: signInError } = await authClient.signIn.email({ email, password })

    setIsSubmitting(false)

    if (signInError) {
      setError(signInError.message || 'Could not sign in with those credentials.')
      return
    }

    router.push(searchParams.get('from') || '/')
    router.refresh()
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <form onSubmit={handleSubmit} className="glass glass-card" style={{ width: '100%', maxWidth: 380 }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Sign in</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={{ width: '100%' }}
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            style={{ width: '100%' }}
          />

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{error}</p>
          )}

          <button type="submit" className="btn" disabled={isSubmitting} style={{ width: '100%' }}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </form>
    </main>
  )
}
