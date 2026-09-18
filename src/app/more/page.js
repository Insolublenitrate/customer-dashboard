'use client'

import Link from 'next/link'
import { Wrench, MessageSquare, Package, Boxes, Ship, ShieldCheck } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { SYSTEM_ADMIN } from '@/lib/roles'

const LINKS = [
  { href: '/sourcing', label: 'Sourcing', description: 'Machines on order overseas — build progress and container shipments.', icon: Ship },
  { href: '/machines', label: 'Machines', description: 'Every installed unit, across all facilities.', icon: Wrench },
  { href: '/machine-models', label: 'Machine models', description: 'The size/model catalog — tank capacity and fill cadence.', icon: Boxes },
  { href: '/communications', label: 'Communications', description: 'Upload meeting minutes and emails.', icon: MessageSquare },
  { href: '/products', label: 'Products', description: 'The detergent/parts catalog.', icon: Package },
]

// Admin lives here rather than in the radial menu: it is opened rarely, and a
// twelfth radial item would need the two rings re-tuned. The description shown
// depends on the role, because only a system admin gets the System panel.
const ADMIN_LINK = {
  href: '/admin',
  label: 'Admin',
  icon: ShieldCheck,
}

export default function MorePage() {
  const { data: session } = authClient.useSession()
  const isSystemAdmin = session?.user?.role === SYSTEM_ADMIN
  const links = [
    ...LINKS,
    {
      ...ADMIN_LINK,
      description: isSystemAdmin
        ? 'Logins and roles, plus the AI model, key and spend.'
        : 'Logins and roles for this account.',
    },
  ]

  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">More</h1>
          <p>The rest of the toolkit.</p>
        </div>
      </div>

      <div className="metrics-grid">
        {links.map((link) => {
          const Icon = link.icon
          return (
            <Link key={link.href} href={link.href} className="glass glass-card interactive" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon size={18} color="var(--primary-hover)" />
                <h3 style={{ margin: 0 }}>{link.label}</h3>
              </div>
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>{link.description}</p>
            </Link>
          )
        })}
      </div>
    </main>
  )
}
