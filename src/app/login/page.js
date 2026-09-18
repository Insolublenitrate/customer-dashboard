'use client'

import { Suspense, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { LoginSchema } from '@/lib/schemas'
import FormError from '../components/FormError'

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
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async ({ email, password }) => {
    const { error } = await authClient.signIn.email({ email, password })
    if (error) {
      // Deliberately not "no such user" vs "wrong password" — that difference
      // tells an attacker which addresses have accounts.
      setError('root', { message: error.message || 'Those credentials did not work. Check them and try again.' })
      return
    }
    router.push(searchParams.get('from') || '/')
    router.refresh()
  }

  return (
    <main className="login-shell">
      <div className="login-panel">
        <div className="login-brand">
          <span className="login-brand-mark" />
          Account Dashboard
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="glass glass-card login-card">
          <h1 className="login-title">Sign in</h1>
          <p className="login-subtitle">Facilities, machines, stock and sourcing in one place.</p>

          <div className="login-fields">
            <div className="field">
              <label className="login-label" htmlFor="email">Email</label>
              <input
                id="email"
                className={`input ${errors.email ? 'input-invalid' : ''}`}
                type="email"
                autoComplete="email"
                autoFocus
                {...register('email')}
              />
              <FormError error={errors.email} />
            </div>

            <div className="field">
              <label className="login-label" htmlFor="password">Password</label>
              {/* The toggle sits inside the field box so the input keeps its
                  full width and the 44px tap target is not squeezed. */}
              <div className="login-password">
                <input
                  id="password"
                  className={`input ${errors.password ? 'input-invalid' : ''}`}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <FormError error={errors.password} />
            </div>

            {errors.root && (
              <div className="login-alert" role="alert">
                {errors.root.message}
              </div>
            )}

            <button type="submit" className="btn login-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>

        {/* There is no sign-up link because there is no sign-up: accounts are
            made with scripts/createUser.mjs. Saying so beats a dead link. */}
        <p className="login-footnote">Accounts are set up by your administrator.</p>
      </div>
    </main>
  )
}
