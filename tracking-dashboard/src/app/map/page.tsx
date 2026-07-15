'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback, useRef } from 'react'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import type { DeviceLocation } from '@/lib/api/types'


// Leaflet must be loaded client-side only
const LiveMapComponent = dynamic(() => import('@/components/map/LiveMap'), { ssr: false, loading: () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)', minHeight: 500 }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
      <div style={{ color: 'var(--text-secondary)' }}>Loading map...</div>
    </div>
  </div>
)})

export default function MapPage() {
  const { accessToken, account, contextAccount } = useAuthStore()
  const [devices, setDevices] = useState<DeviceLocation[]>([])
  const [selected, setSelected] = useState<DeviceLocation | null>(null)
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [search, setSearch] = useState('')
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)


  const fetchLocations = useCallback(async () => {
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
        setDevices(json.data)
        setLastUpdate(new Date())
      }
    } catch (e) {
      console.error('Failed to fetch locations:', e)
    }
  }, [accessToken, account, contextAccount])

  useEffect(() => {
    fetchLocations()
    const iv = setInterval(fetchLocations, 30000)
    return () => clearInterval(iv)
  }, [fetchLocations])

  const filtered = devices.filter(d => {
    const matchStatus = filter === 'all' || (filter === 'online' ? d.status === '1' : d.status === '0')
    const matchSearch = !search || d.deviceName.toLowerCase().includes(search.toLowerCase()) || d.imei.includes(search)
    return matchStatus && matchSearch
  })

  return (
    <>
      <Topbar title="Live Map" subtitle={lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString('id-ID')}` : 'Loading...'} />

      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - var(--topbar-h) - 48px)' }}>
        {/* Map */}
        <div style={{ flex: 1, borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--bg-border)', position: 'relative' }}>
          <LiveMapComponent devices={filtered} selected={selected} onSelect={setSelected} />

          {/* Map Controls */}
          <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 1000, display: 'flex', gap: 8 }}>
            {(['all','online','offline'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textTransform: 'capitalize' }}>{f}</button>
            ))}
            <button className="btn btn-sm btn-secondary" onClick={fetchLocations}>↻ Refresh</button>
          </div>
        </div>

        {/* Sidebar Panel */}
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' }}>
          <input className="form-input" placeholder="🔍 Search device or IMEI..." value={search} onChange={e => setSearch(e.target.value)} />

          {/* Selected device info */}
          {selected && (
            <div className="card" style={{ flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: 'var(--cyan)' }}>📍 {selected.deviceName}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                {[
                  { label: 'IMEI', value: selected.imei, mono: true },
                  { label: 'Status', value: selected.status === '1' ? '🟢 Online' : '🔴 Offline' },
                  { label: 'Speed', value: `${selected.speed} km/h` },
                  { label: 'ACC', value: selected.accStatus === '1' ? '🔑 ON' : '🔑 OFF' },
                  { label: 'GPS Time', value: selected.gpsTime?.slice(0,16) },
                  { label: 'Satellites', value: selected.gpsNum },
                  { label: 'Signal', value: '▐'.repeat(Number(selected.gpsSignal)) + '░'.repeat(4 - Number(selected.gpsSignal)) },
                  { label: 'Battery', value: selected.batteryPowerVal ? `${selected.batteryPowerVal}%` : '—' },
                  { label: 'Mileage', value: `${Number(selected.currentMileage).toFixed(1)} km` },
                ].map(row => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    <span className={row.mono ? 'mono' : ''} style={{ fontWeight: 600, textAlign: 'right' }}>{row.value || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device list */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map(d => (
              <div key={d.imei} onClick={() => setSelected(d)} style={{
                padding: '10px 14px', background: selected?.imei === d.imei ? 'rgba(0,212,255,0.08)' : 'var(--bg-surface)',
                border: `1px solid ${selected?.imei === d.imei ? 'rgba(0,212,255,0.3)' : 'var(--bg-border)'}`,
                borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'var(--transition)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{d.deviceName}</div>
                    <div className="mono">{d.imei}</div>
                  </div>
                  <span className={`badge badge-${d.status === '1' ? (Number(d.speed) > 0 ? 'moving' : 'online') : 'offline'}`}
                    style={{ fontSize: 10 }}>
                    {d.status === '1' ? (Number(d.speed) > 0 ? `${d.speed}km/h` : 'Online') : 'Offline'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div>{filtered.length} of {devices.length} devices · auto-refresh 30s</div>
          </div>
        </div>
      </div>
    </>
  )
}
