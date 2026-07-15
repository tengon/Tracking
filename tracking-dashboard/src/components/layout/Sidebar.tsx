'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'

const navItems = [
  {
    section: 'Monitoring', items: [
      { href: '/', icon: '📊', label: 'Dashboard' },
      { href: '/map', icon: '📍', label: 'Live Map' },
      { href: '/devices', icon: '🚗', label: 'Devices' },
      { href: '/trips', icon: '📜', label: 'Trip History & Playback' },
      { href: '/alarms', icon: '🔔', label: 'Alarms', badge: true },
    ]
  },
  {
    section: 'Fitur', items: [
      { href: '/geofences', icon: '🗺️', label: 'Geofences' },
      { href: '/media', icon: '🎥', label: 'Media / Camera' },
      { href: '/obd', icon: '🔧', label: 'OBD Data' },
      { href: '/reports', icon: '📈', label: 'Reports' },
    ]
  },
  {
    section: 'Manajemen', items: [
      { href: '/users', icon: '👥', label: 'User Management' },
    ]
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { account, clearAuth } = useAuthStore()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🛰️</div>
        <div>
          <div className="sidebar-logo-text">TrackSolid</div>
          <div className="sidebar-logo-sub">Fleet Dashboard</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(group => (
          <div key={group.section}>
            <div className="sidebar-section">{group.section}</div>
            {group.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-item ${pathname === item.href ? 'active' : ''}`}
              >
                <span style={{ fontSize: 17 }}>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && <span className="badge">!</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
          Logged in as <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{account || '—'}</span>
        </div>
        <button
          className="btn btn-ghost btn-sm w-full"
          style={{ justifyContent: 'flex-start' }}
          onClick={clearAuth}
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  )
}
