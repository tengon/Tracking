'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'

interface NavItem {
  href: string
  label: string
  iconImg?: string
  icon?: string
  badge?: boolean
}

interface NavGroup {
  section: string
  items: NavItem[]
}

const navItems: NavGroup[] = [
  {
    section: 'Monitoring',
    items: [
      { href: '/', iconImg: '/images/dashboard-icon.png', label: 'Dashboard' },
      { href: '/map', iconImg: '/images/live-icon.png', label: 'Live Map' },
      { href: '/devices', iconImg: '/images/devices-icon.png', label: 'Devices' },
      { href: '/trips', iconImg: '/images/playback-history-icon.png', label: 'Trip History & Playback' },
      { href: '/alarms', iconImg: '/images/alarm-icon.png', label: 'Alarms', badge: true },
    ]
  },
  {
    section: 'Fitur',
    items: [
      { href: '/geofences', icon: '🗺️', label: 'Geofences' },
      { href: '/media', iconImg: '/images/media-camera-icon.png', label: 'Media / Camera' },
      { href: '/obd', icon: '🔧', label: 'OBD Data' },
      { href: '/reports', icon: '📈', label: 'Reports' },
    ]
  },
  {
    section: 'Manajemen',
    items: [
      { href: '/users', iconImg: '/images/user-management-icon.png', label: 'User Management' },
    ]
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const { account, clearAuth } = useAuthStore()

  return (
    <aside className="sidebar">
      {/* Sidebar Header / Logo */}
      <div
        className="sidebar-logo"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '1px 1px',
          margin: '1px 1px 1px',
          borderRadius: 10,
          backgroundColor: '#ffffffd8',
          background: 'var(--logo-bg)',
          boxShadow: 'var(--logo-shadow)',
          border: '1.5px solid var(--logo-border)',
          transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        <img
          src="/images/fleet-management-icon.png"
          alt="Logo"
          style={{ width: 115, height: 44, borderRadius: 6, objectFit: 'contain' }}
        />
      </div>

      {/* Navigation Items (Futuristic Icon Pod + Title Below) */}
      <nav className="sidebar-nav" style={{ padding: '8px 12px' }}>
        {navItems.map(group => (
          <div key={group.section} style={{ marginBottom: 14 }}>
            <div className="sidebar-section">
              {group.section}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {group.items.map(item => {
                const isActive = pathname === item.href

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-item ${isActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      padding: '12px 8px 10px',
                      borderRadius: 'var(--r-lg)',
                      margin: '2px 0',
                      position: 'relative',
                      gap: 3,
                      background: isActive
                        ? 'linear-gradient(180deg, rgba(0, 245, 255, 0.08) 0%, rgba(10, 10, 20, 0.8) 100%)'
                        : 'transparent',
                      border: isActive
                        ? '1px solid rgba(0, 245, 255, 0.25)'
                        : '1px solid transparent',
                      boxShadow: isActive
                        ? '0 4px 20px rgba(0, 245, 255, 0.12), inset 0 0 15px rgba(0, 245, 255, 0.05)'
                        : 'none',
                      transition: 'var(--transition)',
                    }}
                  >
                    {/* Icon Container (Transparent Background) */}
                    <div
                      style={{
                        width: 50,
                        height: 50,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        background: 'transparent',
                        transition: 'var(--transition)',
                      }}
                    >
                      {item.iconImg ? (
                        <img
                          src={item.iconImg}
                          alt={item.label}
                          style={{
                            width: 44,
                            height: 44,
                            objectFit: 'contain',
                            filter: isActive
                              ? 'drop-shadow(0 0 8px rgba(0,245,255,0.8)) brightness(1.15)'
                              : 'brightness(0.9) opacity(0.85)',
                            transition: 'var(--transition)',
                          }}
                        />
                      ) : (
                        <span style={{ fontSize: 28, lineHeight: 1 }}>{item.icon}</span>
                      )}

                    </div>

                    {/* Menu Label */}
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? 'var(--cyan)' : 'var(--text-secondary)',
                        lineHeight: 1.25,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {item.label}
                    </span>

                    {/* Alert Badge */}
                    {item.badge && (
                      <span
                        className="badge"
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 12,
                          padding: '2px 6px',
                          fontSize: 10,
                          borderRadius: 10,
                          boxShadow: 'var(--glow-red)',
                        }}
                      >
                        !
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="sidebar-footer" style={{ padding: '12px 16px', textAlign: 'center' }}>
        <button
          className="btn btn-ghost btn-sm w-full"
          style={{ justifyContent: 'center' }}
          onClick={clearAuth}
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  )
}
