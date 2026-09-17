'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/facilities', label: 'Facilities' },
  { href: '/communications', label: 'Communications' },
  { href: '/tasks', label: 'Tasks' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = authClient.useSession()

  if (pathname === '/login') return null

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="container" style={{ paddingBottom: 0 }}>
      <div className="nav-tabs" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`btn ${pathname === link.href ? '' : 'btn-secondary'}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        {session?.user && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{session.user.name}</span>
            <button onClick={handleSignOut} className="btn btn-secondary">
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
