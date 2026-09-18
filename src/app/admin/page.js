'use client'

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, X, ShieldCheck, UserRound, Ban, KeyRound } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { apiFetch } from '@/lib/apiFetch'
import { NewUserSchema } from '@/lib/schemas'
import { SYSTEM_ADMIN, OWNER, ROLE_LABELS, ROLE_DESCRIPTIONS } from '@/lib/roles'
import FormError from '../components/FormError'

const emptyUser = { name: '', email: '', password: '', role: OWNER }

function money(n) {
  if (n === null || n === undefined) return '—'
  return n < 0.01 && n > 0 ? '<$0.01' : `$${n.toFixed(2)}`
}

function tokens(n) {
  return Number(n || 0).toLocaleString()
}

export default function AdminPage() {
  const { data: session, isPending } = authClient.useSession()
  const role = session?.user?.role
  const isSystemAdmin = role === SYSTEM_ADMIN

  const [users, setUsers] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [usersError, setUsersError] = useState('')
  const [ai, setAi] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(NewUserSchema),
    defaultValues: emptyUser,
  })

  const loadUsers = useCallback(() => (
    authClient.admin
      .listUsers({ query: { limit: 100 } })
      .then(({ data, error }) => {
        if (error) {
          setUsersError(error.message || 'Could not load the people on this account.')
        } else {
          setUsersError('')
          setUsers(data?.users || [])
        }
      })
      .catch((err) => {
        console.error('Failed to load users:', err)
        setUsersError('Could not load the people on this account.')
      })
      .finally(() => setLoadingUsers(false))
  ), [])

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // The owner is not allowed this endpoint and does not see the panel, so
    // asking for it would only produce a 403 in their console.
    if (!isSystemAdmin) return
    apiFetch('/api/admin/ai')
      .then((res) => (res.ok ? res.json() : null))
      .then(setAi)
      .catch((err) => console.error('Failed to load AI usage:', err))
  }, [isSystemAdmin])

  const onCreate = async (values) => {
    const { error } = await authClient.admin.createUser(values)
    if (error) {
      setError('root', { message: error.message || 'Could not create that login.' })
      return
    }
    setIsModalOpen(false)
    reset(emptyUser)
    loadUsers()
  }

  const toggleBan = async (user) => {
    setBusyId(user.id)
    if (user.banned) await authClient.admin.unbanUser({ userId: user.id })
    else await authClient.admin.banUser({ userId: user.id, banReason: 'Access paused from the admin screen' })
    setBusyId(null)
    loadUsers()
  }

  const resetPassword = async (user) => {
    const next = window.prompt(`New password for ${user.name} (at least 8 characters):`)
    if (!next) return
    if (next.length < 8) {
      window.alert('That password is too short — use at least 8 characters.')
      return
    }
    setBusyId(user.id)
    const { error } = await authClient.admin.setUserPassword({ userId: user.id, newPassword: next })
    setBusyId(null)
    window.alert(error ? (error.message || 'Could not change that password.') : `Password updated for ${user.name}.`)
  }

  const changeRole = async (user, nextRole) => {
    setBusyId(user.id)
    const { error } = await authClient.admin.setRole({ userId: user.id, role: nextRole })
    setBusyId(null)
    if (error) window.alert(error.message || 'Could not change that role.')
    loadUsers()
  }

  if (isPending) {
    return <main className="container"><div className="loader" /></main>
  }

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">Admin</h1>
          <p>
            {isSystemAdmin
              ? 'People on this account, and what the AI features are costing.'
              : 'People on this account.'}
          </p>
        </div>
        <button className="btn" onClick={() => setIsModalOpen(true)}>
          <Plus size={16} />
          Add person
        </button>
      </div>

      {/* ---------------------------------------------------------------- People */}
      <section className="glass glass-card" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-section-head">
          <UserRound size={18} color="var(--primary-hover)" />
          <h2 className="admin-section-title">People</h2>
        </div>

        {loadingUsers ? (
          <div className="loader" />
        ) : usersError ? (
          <p className="text-muted">{usersError}</p>
        ) : users.length === 0 ? (
          <p className="text-muted">No logins yet.</p>
        ) : (
          <div className="admin-people">
            {users.map((u) => {
              const isMe = u.id === session?.user?.id
              return (
                <div key={u.id} className="admin-person">
                  <div style={{ minWidth: 0 }}>
                    <div className="admin-person-name">
                      {u.name}
                      {isMe && <span className="badge">you</span>}
                      {u.banned && <span className="badge badge-danger">paused</span>}
                    </div>
                    <div className="admin-person-email">{u.email}</div>
                    <div className="admin-person-role">
                      {ROLE_LABELS[u.role] || u.role || 'No role'}
                      {u.role === SYSTEM_ADMIN && <ShieldCheck size={13} />}
                    </div>
                  </div>

                  <div className="admin-person-actions">
                    {/* Only a system admin sees the role control. An owner who
                        could set roles could grant themselves the AI panel,
                        which would make the whole split decorative. */}
                    {isSystemAdmin && !isMe && (
                      <select
                        className="input admin-role-select"
                        value={u.role || OWNER}
                        disabled={busyId === u.id}
                        onChange={(e) => changeRole(u, e.target.value)}
                        aria-label={`Role for ${u.name}`}
                      >
                        <option value={OWNER}>{ROLE_LABELS[OWNER]}</option>
                        <option value={SYSTEM_ADMIN}>{ROLE_LABELS[SYSTEM_ADMIN]}</option>
                      </select>
                    )}
                    <button
                      className="btn btn-secondary admin-icon-btn"
                      onClick={() => resetPassword(u)}
                      disabled={busyId === u.id}
                      aria-label={`Set a new password for ${u.name}`}
                      title="Set a new password"
                    >
                      <KeyRound size={15} />
                    </button>
                    {/* Two people are never offered the pause button: yourself,
                        and — when you are the owner — a system admin. An owner
                        cannot read the AI panel, but pausing the only account
                        that can would lock the installation out of it by
                        accident. This is an accident guard in the UI, not a
                        server-enforced boundary: better-auth's ban endpoint
                        still accepts the call, because `user: ['ban']` is part
                        of the owner role. Say so rather than implying more. */}
                    {!isMe && !(!isSystemAdmin && u.role === SYSTEM_ADMIN) && (
                      <button
                        className="btn btn-secondary admin-icon-btn"
                        onClick={() => toggleBan(u)}
                        disabled={busyId === u.id}
                        aria-label={u.banned ? `Restore access for ${u.name}` : `Pause access for ${u.name}`}
                        title={u.banned ? 'Restore access' : 'Pause access'}
                      >
                        <Ban size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-muted admin-note">
          {ROLE_LABELS[OWNER]}: {ROLE_DESCRIPTIONS[OWNER]}
          <br />
          {ROLE_LABELS[SYSTEM_ADMIN]}: {ROLE_DESCRIPTIONS[SYSTEM_ADMIN]}
        </p>
      </section>

      {/* ---------------------------------------------------------------- System */}
      {isSystemAdmin && (
        <section className="glass glass-card">
          <div className="admin-section-head">
            <ShieldCheck size={18} color="var(--primary-hover)" />
            <h2 className="admin-section-title">System</h2>
            <span className="badge">system admin only</span>
          </div>

          {!ai ? (
            <div className="loader" />
          ) : (
            <>
              <div className="metric-strip admin-system-strip">
                <div className="metric-strip-item">
                  <span className="metric-strip-label">Model</span>
                  <span className="metric-strip-value">{ai.model}</span>
                </div>
                <div className="metric-strip-item">
                  <span className="metric-strip-label">API key</span>
                  <span className="metric-strip-value">
                    {ai.api_key?.configured ? `set ${ai.api_key.hint}` : 'not set'}
                  </span>
                </div>
                <div className="metric-strip-item">
                  <span className="metric-strip-label">Last {ai.window_days} days</span>
                  <span className="metric-strip-value">{money(ai.total_cost)}</span>
                </div>
              </div>

              {!ai.api_key?.configured && (
                <div className="login-alert" role="alert" style={{ marginBottom: '1rem' }}>
                  ANTHROPIC_API_KEY is not set, so the briefing, Ask and drafting
                  features will fail. Set it in the deployment&apos;s environment.
                </div>
              )}

              {ai.usage.length === 0 ? (
                <p className="text-muted">No AI calls recorded in the last {ai.window_days} days.</p>
              ) : (
                <div className="admin-usage">
                  {ai.usage.map((u) => (
                    <div key={`${u.feature}-${u.model}`} className="admin-usage-row">
                      <div>
                        <div className="admin-usage-feature">{u.feature}</div>
                        <div className="admin-person-email">
                          {u.calls} call{u.calls === 1 ? '' : 's'}
                          {u.failures > 0 && ` · ${u.failures} failed`}
                          {' · '}
                          {tokens(u.input_tokens)} in / {tokens(u.output_tokens)} out
                        </div>
                      </div>
                      <div className="admin-usage-cost">{money(u.cost)}</div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-muted admin-note">
                Costed at ${ai.pricing?.inputPerMTok}/M input and ${ai.pricing?.outputPerMTok}/M
                output, the published rate for {ai.model} as of {ai.pricing_as_of}. A snapshot,
                not a bill — check your Anthropic console for what you were actually charged.
              </p>
            </>
          )}
        </section>
      )}

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => { setIsModalOpen(false); reset(emptyUser) }}>
          <form
            onSubmit={handleSubmit(onCreate)}
            noValidate
            className="glass modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0 }}>Add a person</h2>
              <button
                type="button"
                onClick={() => { setIsModalOpen(false); reset(emptyUser) }}
                className="btn btn-secondary"
                style={{ padding: '0.5rem', minHeight: 'auto' }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="field">
                <input className={`input ${errors.name ? 'input-invalid' : ''}`} placeholder="Name" {...register('name')} />
                <FormError error={errors.name} />
              </div>
              <div className="field">
                <input className={`input ${errors.email ? 'input-invalid' : ''}`} type="email" placeholder="Email" {...register('email')} />
                <FormError error={errors.email} />
              </div>
              <div className="field">
                <input className={`input ${errors.password ? 'input-invalid' : ''}`} type="text" placeholder="Temporary password" {...register('password')} />
                <FormError error={errors.password} />
              </div>

              {/* Only a system admin may hand out the system admin role. */}
              {isSystemAdmin ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.8125rem' }} className="text-muted">
                  Role
                  <select className="input" {...register('role')}>
                    <option value={OWNER}>{ROLE_LABELS[OWNER]}</option>
                    <option value={SYSTEM_ADMIN}>{ROLE_LABELS[SYSTEM_ADMIN]}</option>
                  </select>
                </label>
              ) : (
                <input type="hidden" {...register('role')} value={OWNER} />
              )}

              <FormError error={errors.root} />
              <button type="submit" className="btn" disabled={isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create login'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
