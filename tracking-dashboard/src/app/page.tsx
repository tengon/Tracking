'use client'
import { useEffect, useState } from 'react'
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

  useEffect(() => {
    fetchLocations()
    const interval = setInterval(fetchLocations, 30000)
    return () => clearInterval(interval)
  }, [accessToken, account, contextAccount])

  const online  = locations.filter(d => d.status === '1').length
  const offline = locations.filter(d => d.status === '0').length
  const moving  = locations.filter(d => d.status === '1' && Number(d.speed) > 0).length
  const total   = locations.length

  const alarmCount = 0 // Placeholder

  const recentAlarms = [
    { type: 'Speeding', device: 'B-1234 XX', time: '5 min ago', icon: '🚨' },
    { type: 'Geofence Exit', device: 'D-5678 YY', time: '12 min ago', icon: '🗺️' },
    { type: 'Low Battery', device: 'F-9012 ZZ', time: '31 min ago', icon: '🔋' },
  ]

  return (
    <>
      <Topbar title="Dashboard" subtitle={lastUpdate ? `Last update: ${lastUpdate.toLocaleTimeString('id-ID')}` : 'Loading...'} />

      <div style={{ maxWidth: 1400 }}>
        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'} 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            Fleet overview for account <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{account}</span>
          </p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <StatCard icon="🚗" label="Total Devices"  value={loading ? '—' : total}   accent="var(--cyan)"   />
          <StatCard icon="🟢" label="Online"         value={loading ? '—' : online}  accent="var(--green)"  delta={total > 0 ? `${Math.round(online/total*100)}% uptime` : ''} />
          <StatCard icon="🔴" label="Offline"        value={loading ? '—' : offline} accent="var(--red)"    />
          <StatCard icon="▶️"  label="Moving"         value={loading ? '—' : moving}  accent="var(--cyan)"   />
          <StatCard icon="🔔" label="Active Alarms"  value={alarmCount}              accent="var(--amber)"  />
        </div>

        {/* Body Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
          {/* Device Table */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>📋 Device Status</span>
              <button onClick={fetchLocations} className="btn btn-secondary btn-sm">↻ Refresh</button>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>Speed</th>
                    <th>GPS Signal</th>
                    <th>Last Update</th>
                    <th>Battery</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [...Array(4)].map((_, i) => (
                      <tr key={i}>
                        {[...Array(7)].map((_, j) => (
                          <td key={j}><div className="skeleton" style={{ height: 16, width: '80%' }} /></td>
                        ))}
                      </tr>
                    ))
                  ) : locations.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>No devices found</td></tr>
                  ) : (
                    locations.slice(0, 10).map(d => (
                      <tr key={d.imei}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13, color: d.customColor || 'var(--text-primary)' }}>{d.deviceName}</div>
                          <div className="mono">{d.imei}</div>
                        </td>
                        <td>
                          {d.assignedTo ? (
                            <span style={{ fontSize: 10, color: 'var(--cyan)', background: 'rgba(0,245,255,0.08)', padding: '2px 8px', borderRadius: 4, fontWeight: 700, border: '1px solid rgba(0,245,255,0.2)' }}>
                              👤 {d.assignedTo}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${d.status === '1' ? (Number(d.speed) > 0 ? 'moving' : 'online') : 'offline'}`}>
                            {d.status === '1' ? (Number(d.speed) > 0 ? '▶ Moving' : '● Online') : '✕ Offline'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: Number(d.speed) > 0 ? 'var(--cyan)' : 'var(--text-muted)' }}>
                          {d.speed} km/h
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 3 }}>
                            {[1,2,3,4].map(i => (
                              <div key={i} style={{
                                width: 4, height: 12 * (i/4) + 4,
                                background: Number(d.gpsSignal) >= i ? 'var(--green)' : 'var(--bg-border)',
                                borderRadius: 2, alignSelf: 'flex-end'
                              }} />
                            ))}
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          {d.hbTime?.slice(11,16) || '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: 12, color: Number(d.batteryPowerVal) < 20 ? 'var(--red)' : 'var(--text-secondary)' }}>
                            {d.batteryPowerVal ? `${d.batteryPowerVal}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
