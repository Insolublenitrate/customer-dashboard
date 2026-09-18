'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, TrendingUp, Building2, PackageSearch, ClipboardList, MoreHorizontal,
  Ship, Wrench, Boxes, MessageSquare, Package, Menu, X, LogOut,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'

const LINKS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/insights', label: 'Insights', icon: TrendingUp },
  { href: '/facilities', label: 'Facilities', icon: Building2 },
  { href: '/orders', label: 'Orders', icon: PackageSearch },
  { href: '/tasks', label: 'Tasks', icon: ClipboardList },
  { href: '/more', label: 'More', icon: MoreHorizontal, matches: ['/more', '/sourcing', '/machines', '/machine-models', '/communications', '/products'] },
]

// The radial menu reaches every destination directly, so it skips the "More"
// overflow page the desktop bar needs. Inner arc = daily drivers, outer arc =
// the rest; both sit inside a right thumb's sweep from the corner.
const RADIAL_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard, ring: 0 },
  { href: '/insights', label: 'Insights', icon: TrendingUp, ring: 0 },
  { href: '/facilities', label: 'Facilities', icon: Building2, ring: 0 },
  { href: '/tasks', label: 'Tasks', icon: ClipboardList, ring: 0 },
  { href: '/orders', label: 'Orders', icon: PackageSearch, ring: 1 },
  { href: '/sourcing', label: 'Sourcing', icon: Ship, ring: 1 },
  { href: '/machines', label: 'Machines', icon: Wrench, ring: 1 },
  { href: '/machine-models', label: 'Models', icon: Boxes, ring: 1 },
  { href: '/communications', label: 'Comms', icon: MessageSquare, ring: 1 },
  { href: '/products', label: 'Products', icon: Package, ring: 1 },
]

// Each ring gets its own radius and sweep. The sweeps are deliberately offset
// so outer items land between inner ones rather than directly behind them,
// which keeps the labels from stacking on top of each other.
const RINGS = [
  { radius: 140, start: 14, end: 78 },
  { radius: 215, start: 8, end: 84 },
]

const LABEL_OFFSET = 33

// Lays each item on its ring's arc, sweeping up-and-left from the corner. The
// label is pushed further along the same radius rather than sitting under the
// icon — on a downward-curving arc, "below" is exactly where the next item is.
function radialPosition(item, indexInRing, ringCount) {
  const { radius, start, end } = RINGS[item.ring]
  const step = ringCount > 1 ? (end - start) / (ringCount - 1) : 0
  const angle = ((start + step * indexInRing) * Math.PI) / 180
  const dx = -Math.sin(angle)
  const dy = -Math.cos(angle)
  return {
    x: Math.round(radius * dx),
    y: Math.round(radius * dy),
    lx: Math.round(LABEL_OFFSET * dx),
    ly: Math.round(LABEL_OFFSET * dy),
  }
}

function isActive(pathname, link) {
  if (link.matches) return link.matches.some((m) => pathname.startsWith(m))
  if (link.href === '/') return pathname === '/'
  return pathname.startsWith(link.href)
}

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = authClient.useSession()
  // Tracking which route the menu was opened on means any navigation — a tap,
  // or the browser's back button — closes it without a route-change effect.
  const [openedOnPath, setOpenedOnPath] = useState(null)
  const isRadialOpen = openedOnPath === pathname
  const setIsRadialOpen = (open) => setOpenedOnPath(open ? pathname : null)

  useEffect(() => {
    if (!isRadialOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpenedOnPath(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isRadialOpen])

  if (pathname === '/login') return null

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  const ringCounts = RADIAL_ITEMS.reduce((counts, item) => {
    counts[item.ring] = (counts[item.ring] || 0) + 1
    return counts
  }, {})
  const ringIndexes = {}

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
              className={`top-bar-link ${isActive(pathname, link) ? 'is-active' : ''}`}
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

      <div className={`radial-nav ${isRadialOpen ? 'is-open' : ''}`}>
        <button
          type="button"
          className="radial-backdrop"
          aria-label="Close navigation"
          tabIndex={isRadialOpen ? 0 : -1}
          onClick={() => setIsRadialOpen(false)}
        />

        {RADIAL_ITEMS.map((item, index) => {
          const indexInRing = ringIndexes[item.ring] ?? 0
          ringIndexes[item.ring] = indexInRing + 1
          const { x, y, lx, ly } = radialPosition(item, indexInRing, ringCounts[item.ring])
          const Icon = item.icon
          const active = isActive(pathname, item)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`radial-item ${active ? 'is-active' : ''}`}
              tabIndex={isRadialOpen ? 0 : -1}
              aria-hidden={!isRadialOpen}
              style={{
                '--x': `${x}px`, '--y': `${y}px`,
                '--lx': `${lx}px`, '--ly': `${ly}px`,
                '--delay': `${index * 18}ms`,
              }}
            >
              <span className="radial-icon">
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              </span>
              <span className="radial-label">{item.label}</span>
            </Link>
          )
        })}

        <button
          type="button"
          className="radial-fab"
          aria-label={isRadialOpen ? 'Close navigation' : 'Open navigation'}
          aria-expanded={isRadialOpen}
          onClick={() => setIsRadialOpen(!isRadialOpen)}
        >
          {isRadialOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </>
  )
}
