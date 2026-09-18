'use client'

import Link from 'next/link'
import { Wrench, MessageSquare, Package, Boxes, Ship } from 'lucide-react'

const LINKS = [
  { href: '/sourcing', label: 'Sourcing', description: 'Machines on order overseas — build progress and container shipments.', icon: Ship },
  { href: '/machines', label: 'Machines', description: 'Every installed unit, across all facilities.', icon: Wrench },
  { href: '/machine-models', label: 'Machine models', description: 'The size/model catalog — tank capacity and fill cadence.', icon: Boxes },
  { href: '/communications', label: 'Communications', description: 'Upload meeting minutes and emails.', icon: MessageSquare },
  { href: '/products', label: 'Products', description: 'The detergent/parts catalog.', icon: Package },
]

export default function MorePage() {
  return (
    <main className="container">
      <div className="dashboard-header">
        <div>
          <h1 className="gradient-text">More</h1>
          <p>The rest of the toolkit.</p>
        </div>
      </div>

      <div className="metrics-grid">
        {LINKS.map((link) => {
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
