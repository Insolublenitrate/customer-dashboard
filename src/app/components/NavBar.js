'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Building2, MessageSquare, ClipboardList, LogOut } from 'lucide-react'
import { authClient } from '@/lib/auth-client'

const LINKS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/facilities', label: 'Facilities', icon: Building2 },
  { href: '/communications', label: 'Communications', icon: MessageSquare },
  { href: '/tasks', label: 'Tasks', icon: ClipboardList },
]

function isActive(pathname, href) {
  if (href === '/') return pathname === '/'
  return pathname.startsWith(href)
}

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
    <>
      <header className="top-bar">
        <Link href="/" className="top-bar-brand">
          <span
            style={{
              width: 8, height: 8, borderRadius: 999,
              background: 'linear-gradient(135deg, var(--primary), var(--accent))',
              flexShrink: 0,
            }}
          />
          Account Dashboard
        </Link>

        <nav className="top-bar-links">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`top-bar-link ${isActive(pathname, link.href) ? 'is-active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {session?.user && (
          <div className="top-bar-user">
            <span>{session.user.name}</span>
            <button onClick={handleSignOut} className="btn btn-secondary" style={{ padding: '0.4rem 0.7rem', minHeight: 'auto' }}>
              <LogOut size={14} />
            </button>
          </div>
        )}
      </header>

      <nav className="bottom-nav">
        {LINKS.map((link) => {
          const Icon = link.icon
          const active = isActive(pathname, link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`bottom-nav-link ${active ? 'is-active' : ''}`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {link.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
