'use client'
import { useEffect, useState, useMemo } from 'react'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import type { DeviceLocation } from '@/lib/api/types'



function StatCard({ icon, label, value, accent, delta }: {
  icon: string; label: string; value: string | number; accent: string; delta?: string
}) {
  return (
    <div className="stat-card" style={{ '--accent-color': accent } as React.CSSProperties}>
      <div className="stat-icon" style={{ background: `${accent}15` }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div className="stat-info">
        <div className="stat-value" style={{ color: accent }}>{value}</div>
        <div className="stat-label">{label}</div>
        {delta && <div className="stat-delta">{delta}</div>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { accessToken, account, contextAccount } = useAuthStore()
  const [locations, setLocations] = useState<DeviceLocation[]>([])

  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')
  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>({})

  const toggleAccountCollapse = (accKey: string) => {
    setCollapsedAccounts(prev => ({ ...prev, [accKey]: !prev[accKey] }))
  }

  const expandAllAccounts = () => setCollapsedAccounts({})

  const collapseAllAccounts = () => {
    const next: Record<string, boolean> = {}
    Object.keys(groupedLocations).forEach(k => { next[k] = true })
    setCollapsedAccounts(next)
  }

  async function fetchLocations() {
    if (!accessToken || !account) return

    const targetAccount = contextAccount || account;

    try {
      const res = await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, target: account, contextAccount }),
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setLocations(json.data)
        setLastUpdate(new Date())
      }
    } catch (e) {
      console.error('Failed to fetch locations:', e)
    }
    finally { setLoading(false) }
  }

  // ── Auto-refresh: hanya aktif saat tab/halaman terlihat ─────────────────
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    const startPolling = () => {
      if (interval) return // sudah jalan
      fetchLocations()
      interval = setInterval(fetchLocations, 10000)
    }

    const stopPolling = () => {
      if (interval) { clearInterval(interval); interval = null }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') startPolling()
      else stopPolling()
    }

    // Mulai polling hanya jika tab langsung terlihat saat mount
    if (document.visibilityState === 'visible') startPolling()

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [accessToken, account, contextAccount])

  const [subAccounts, setSubAccounts] = useState<any[]>([])

  useEffect(() => {
    if (accessToken && account) {
      fetch(`/api/users?accessToken=${encodeURIComponent(accessToken)}&target=${encodeURIComponent(account)}`)
        .then(res => res.json())
        .then(json => {
          if (json.success && Array.isArray(json.data)) setSubAccounts(json.data)
        })
        .catch(console.error)
    }
  }, [accessToken, account])

  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (account) map.set(account, `${account} (Induk)`)
    subAccounts.forEach((s: any) => {
      map.set(s.account, s.name || s.account)
    })
    return map
  }, [subAccounts, account])

  const online = locations.filter(d => d.status === '1').length
  const offline = locations.filter(d => d.status === '0').length
  const moving = locations.filter(d => d.status === '1' && Number(d.speed) > 0).length
  const total = locations.length

  // Group devices by account matching Live Map grouping schema
  const groupedLocations = useMemo(() => {
    const groups = locations.reduce((acc, loc: any) => {
      const groupName = loc._jimiAccount || loc.assignedTo || account || 'Unassigned'
      if (!acc[groupName]) acc[groupName] = []
      acc[groupName].push(loc)
      return acc
    }, {} as Record<string, DeviceLocation[]>)
    return groups
  }, [locations, account])

  const alarmCount = 0 // Placeholder

  const recentAlarms = [
    { type: 'Speeding', device: 'B-1234 XX', time: '5 min ago', icon: '🚨' },
    { type: 'Geofence Exit', device: 'D-5678 YY', time: '12 min ago', icon: '🗺️' },
    { type: 'Low Battery', device: 'F-9012 ZZ', time: '31 min ago', icon: '🔋' },
  ]

  return (
    <>
      <Topbar title="Dashboard" subtitle="Real-time Fleet Monitoring" lastUpdate={lastUpdate} />

      <div style={{ maxWidth: 1400 }}>
        {/* Greeting 
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            Fleet overview for account <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{account}</span>
          </p>
        </div>*/}

        {/* Stats */}
        <div className="stats-grid">
          <StatCard icon="🚗" label="Total Devices" value={loading ? '—' : total} accent="var(--cyan)" />
          <StatCard icon="🟢" label="Online" value={loading ? '—' : online} accent="var(--green)" delta={total > 0 ? `${Math.round(online / total * 100)}% uptime` : ''} />
          <StatCard icon="🔴" label="Offline" value={loading ? '—' : offline} accent="var(--red)" />
          <StatCard icon="▶️" label="Moving" value={loading ? '—' : moving} accent="var(--cyan)" />
          <StatCard icon="🔔" label="Active Alarms" value={alarmCount} accent="var(--amber)" />
        </div>

        {/* Body Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
          {/* Device List / Cards Container */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Control Bar: Title, Refresh, View Toggle */}
            <div
              className="card"
              style={{
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 18 }}>{viewMode === 'card' ? '🎴' : '📋'}</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>
                  Account Fleet Overview — <span style={{ color: 'var(--cyan)' }}>{Object.keys(groupedLocations).length} Accounts</span>
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* View Mode Toggle */}
                <div style={{ display: 'flex', background: 'var(--bg-base)', padding: 3, borderRadius: 'var(--r-md)', border: '1px solid var(--bg-border)' }}>
                  <button
                    onClick={() => setViewMode('card')}
                    style={{
                      padding: '4px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 6,
                      background: viewMode === 'card' ? 'rgba(0,245,255,0.15)' : 'transparent',
                      color: viewMode === 'card' ? 'var(--cyan)' : 'var(--text-muted)',
                      border: viewMode === 'card' ? '1px solid rgba(0,245,255,0.3)' : '1px solid transparent',
                      transition: 'var(--transition)',
                    }}
                  >
                    🎴 Account Cards
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    style={{
                      padding: '4px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      borderRadius: 6,
                      background: viewMode === 'table' ? 'rgba(0,245,255,0.15)' : 'transparent',
                      color: viewMode === 'table' ? 'var(--cyan)' : 'var(--text-muted)',
                      border: viewMode === 'table' ? '1px solid rgba(0,245,255,0.3)' : '1px solid transparent',
                      transition: 'var(--transition)',
                    }}
                  >
                    📋 Table View
                  </button>
                </div>

                {/* Expand / Minimize All controls when in Card mode */}
                {viewMode === 'card' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={expandAllAccounts}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 10, padding: '4px 8px', border: '1px solid var(--bg-border)' }}
                      title="Besarkan Semua Account Card"
                    >
                      ▼ Besarkan Semua
                    </button>
                    <button
                      onClick={collapseAllAccounts}
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: 10, padding: '4px 8px', border: '1px solid var(--bg-border)' }}
                      title="Kecilkan Semua Account Card"
                    >
                      ▲ Kecilkan Semua
                    </button>
                  </div>
                )}

                <button onClick={fetchLocations} className="btn btn-secondary btn-sm">↻ Refresh</button>
              </div>
            </div>

            {/* 🎴 CARD MODE VIEW */}
            {viewMode === 'card' ? (
              loading ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  ⟳ Loading account cards...
                </div>
              ) : Object.keys(groupedLocations).length === 0 ? (
                <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No account devices found.
                </div>
              ) : (
                Object.entries(groupedLocations).map(([groupAccount, locs]) => {
                  const grpOnline = locs.filter(d => d.status === '1').length
                  const grpMoving = locs.filter(d => d.status === '1' && Number(d.speed) > 0).length
                  const grpOffline = locs.filter(d => d.status === '0').length
                  const isCollapsed = collapsedAccounts[groupAccount] === true

                  return (
                    <div
                      key={groupAccount}
                      className="card"
                      style={{
                        padding: isCollapsed ? '14px 20px' : 20,
                        borderLeft: '4px solid var(--cyan)',
                        background: 'linear-gradient(135deg, rgba(0,245,255,0.03) 0%, rgba(10,10,20,0.6) 100%)',
                        transition: 'var(--transition)',
                      }}
                    >
                      {/* Account Card Header (Clickable to Expand / Minimize) */}
                      <div
                        onClick={() => toggleAccountCollapse(groupAccount)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: isCollapsed ? 0 : 16,
                          flexWrap: 'wrap',
                          gap: 10,
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 22 }}>🏢</span>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--cyan)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.04em' }}>
                              {accountNameMap.get(groupAccount) || groupAccount}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              Account ID: {groupAccount} · {locs.length} Devices ({grpOnline}/{locs.length} Online)
                            </div>
                          </div>
                        </div>

                        {/* Account Metrics Badges & Expand/Minimize Button */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', gap: 8, fontSize: 11, fontWeight: 600 }}>
                            <span style={{ padding: '4px 12px', borderRadius: 12, background: 'rgba(0,255,65,0.1)', color: 'var(--green)', border: '1px solid rgba(0,255,65,0.25)', fontFamily: 'monospace' }}>
                              ● Online: {grpOnline}
                            </span>
                            {grpMoving > 0 && (
                              <span style={{ padding: '4px 12px', borderRadius: 12, background: 'rgba(0,245,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,245,255,0.25)', fontFamily: 'monospace' }}>
                                ▶ Moving: {grpMoving}
                              </span>
                            )}
                            <span style={{ padding: '4px 12px', borderRadius: 12, background: 'rgba(255,0,64,0.1)', color: 'var(--red)', border: '1px solid rgba(255,0,64,0.25)', fontFamily: 'monospace' }}>
                              ✕ Offline: {grpOffline}
                            </span>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleAccountCollapse(groupAccount)
                            }}
                            className="btn btn-ghost btn-sm"
                            style={{
                              fontSize: 11,
                              padding: '4px 10px',
                              borderRadius: 'var(--r-md)',
                              background: isCollapsed ? 'rgba(0,245,255,0.12)' : 'rgba(255,255,255,0.04)',
                              color: isCollapsed ? 'var(--cyan)' : 'var(--text-secondary)',
                              border: `1px solid ${isCollapsed ? 'rgba(0,245,255,0.3)' : 'var(--bg-border)'}`,
                              fontWeight: 700,
                            }}
                          >
                            {isCollapsed ? '▶ Besarkan (Expand)' : '▲ Kecilkan (Minimize)'}
                          </button>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                          {locs.map(d => {
                            const isOnline = d.status === '1'
                            const isMoving = isOnline && Number(d.speed) > 0

                            return (
                              <div
                                key={d.imei}
                                style={{
                                  background: 'var(--bg-elevated)',
                                  border: `1px solid ${isMoving ? 'rgba(0,245,255,0.35)' : isOnline ? 'rgba(0,255,65,0.25)' : 'var(--bg-border)'}`,
                                  borderRadius: 'var(--r-md)',
                                  padding: 14,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 12,
                                  transition: 'var(--transition)',
                                  boxShadow: isMoving ? '0 0 14px rgba(0,245,255,0.08)' : 'none',
                                }}
                              >
                                {/* Device Name & Status */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                  <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13.5, color: d.customColor || 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      🚗 {d.deviceName}
                                    </div>
                                    <div className="mono" style={{ fontSize: 10.5, marginTop: 2 }}>{d.imei}</div>
                                  </div>
                                  <span className={`badge badge-${isMoving ? 'moving' : isOnline ? 'online' : 'offline'}`} style={{ flexShrink: 0 }}>
                                    {isMoving ? '▶ Moving' : isOnline ? '● Online' : '✕ Offline'}
                                  </span>
                                </div>

                                {/* GPS Signal & Time Info */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, borderTop: '1px solid var(--bg-border)', paddingTop: 8 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>GPS:</span>
                                    <div style={{ display: 'flex', gap: 2 }}>
                                      {[1, 2, 3, 4].map(i => (
                                        <div
                                          key={i}
                                          style={{
                                            width: 3,
                                            height: 10 * (i / 4) + 3,
                                            background: Number(d.gpsSignal) >= i ? 'var(--green)' : 'var(--bg-border)',
                                            borderRadius: 1,
                                            alignSelf: 'flex-end',
                                          }}
                                        />
                                      ))}
                                    </div>
                                  </div>

                                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>HB: </span>
                                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{d.hbTime?.slice(11, 16) || '—'}</span>
                                  </div>
                                </div>

                                {/* Quick Action Links */}
                                <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                                  <a
                                    href={`/map?imei=${d.imei}`}
                                    className="btn btn-secondary btn-sm"
                                    style={{ flex: 1, justifyContent: 'center', fontSize: 10, padding: '5px 8px' }}
                                  >
                                    📍 Track Map
                                  </a>
                                  <a
                                    href={`/trips?imei=${d.imei}`}
                                    className="btn btn-ghost btn-sm"
                                    style={{ flex: 1, justifyContent: 'center', fontSize: 10, padding: '5px 8px', border: '1px solid var(--bg-border)' }}
                                  >
                                    📜 History
                                  </a>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )
            ) : (
              /* 📋 TABLE MODE VIEW */
              <div className="card" style={{ padding: 0 }}>
                <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Device</th>
                        <th>Status</th>
                        <th>GPS Signal</th>
                        <th>Last Update</th>
                      </tr>
                    </thead>
                    {loading ? (
                      <tbody>
                        {[...Array(4)].map((_, i) => (
                          <tr key={i}>
                            {[...Array(4)].map((_, j) => (
                              <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    ) : locations.length === 0 ? (
                      <tbody>
                        <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No devices found</td></tr>
                      </tbody>
                    ) : (
                      Object.entries(groupedLocations).map(([group, locs]) => (
                        <tbody key={group}>
                          <tr style={{ background: 'rgba(0,212,255,0.05)' }}>
                            <td colSpan={4} style={{ fontWeight: 700, color: 'var(--cyan)', padding: '10px 16px', borderBottom: '1px solid rgba(0,212,255,0.1)' }}>
                              🏢 {accountNameMap.get(group) || group} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}>({locs.length} devices)</span>
                            </td>
                          </tr>
                          {locs.map(d => (
                            <tr key={d.imei}>
                              <td>
                                <div style={{ fontWeight: 600, fontSize: 13, color: d.customColor || 'var(--text-primary)' }}>{d.deviceName}</div>
                                <div className="mono">{d.imei}</div>
                              </td>
                              <td>
                                <span className={`badge badge-${d.status === '1' ? (Number(d.speed) > 0 ? 'moving' : 'online') : 'offline'}`}>
                                  {d.status === '1' ? (Number(d.speed) > 0 ? '▶ Moving' : '● Online') : '✕ Offline'}
                                </span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: 3 }}>
                                  {[1, 2, 3, 4].map(i => (
                                    <div key={i} style={{
                                      width: 4, height: 12 * (i / 4) + 4,
                                      background: Number(d.gpsSignal) >= i ? 'var(--green)' : 'var(--bg-border)',
                                      borderRadius: 2, alignSelf: 'flex-end'
                                    }} />
                                  ))}
                                </div>
                              </td>
                              <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                {d.hbTime?.slice(11, 16) || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ))
                    )}
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Live Alarms */}
            <div className="card">
              <div className="card-title">🔔 Recent Alarms</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentAlarms.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    padding: '10px 12px', background: 'var(--bg-elevated)',
                    borderRadius: 'var(--r-md)', border: '1px solid var(--bg-border)'
                  }}>
                    <span style={{ fontSize: 20 }}>{a.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.type}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.device}</div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.time}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <div className="card-title">⚡ Quick Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { href: '/map', icon: '📍', label: 'Open Live Map' },
                  { href: '/trips', icon: '📜', label: 'View Trip History' },
                  { href: '/geofences', icon: '🗺️', label: 'Manage Geofences' },
                  { href: '/media', icon: '🎥', label: 'View Camera Feed' },
                ].map(item => (
                  <a key={item.href} href={item.href} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', background: 'var(--bg-elevated)',
                    borderRadius: 'var(--r-md)', border: '1px solid var(--bg-border)',
                    color: 'var(--text-secondary)', fontSize: 13,
                    transition: 'var(--transition)',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--cyan)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(0,212,255,0.3)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--bg-border)' }}
                  >
                    <span>{item.icon}</span> {item.label} <span style={{ marginLeft: 'auto' }}>→</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
