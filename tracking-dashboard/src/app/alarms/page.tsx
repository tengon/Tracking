'use client'
import Topbar from '@/components/layout/Topbar'
import { useEffect, useState, useCallback } from 'react'

const ALARM_CONFIGS: Record<string, { name: string, icon: string, color: string }> = {
  '1': { name: 'SOS Alert', icon: '🚨', color: 'var(--red)' },
  '2': { name: 'Speeding', icon: '⚡', color: 'var(--amber)' },
  '3': { name: 'Geofence In/Out', icon: '🗺️', color: 'var(--purple)' },
  '4': { name: 'Low Battery', icon: '🔋', color: 'var(--amber)' },
  '5': { name: 'ACC On/Off', icon: '🔑', color: 'var(--cyan)' },
  '6': { name: 'Harsh Braking', icon: '🛑', color: 'var(--red)' },
  '7': { name: 'Collision (DVR)', icon: '💥', color: 'var(--red)' },
  '8': { name: 'Distraction (DMS)', icon: '😴', color: 'var(--amber)' },
}

export default function AlarmsPage() {
  const [alarms, setAlarms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAlarms = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/alarms')
      const json = await res.json()
      if (json.success) {
        setAlarms(json.data)
      }
    } catch (e) {
      console.error('Failed to load alarms:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlarms()
    const iv = setInterval(fetchAlarms, 10000) // auto-refresh every 10s
    return () => clearInterval(iv)
  }, [fetchAlarms])

  // Compute counts
  const alarmTypes = Object.entries(ALARM_CONFIGS).map(([id, config]) => {
    const count = alarms.filter(a => String(a.alarm_type) === id).length
    return { id, ...config, count }
  })

  // Group unknown types under a generic bucket
  const knownTypeIds = Object.keys(ALARM_CONFIGS)
  const unknownCount = alarms.filter(a => !knownTypeIds.includes(String(a.alarm_type))).length
  if (unknownCount > 0) {
    alarmTypes.push({ id: '99', name: 'Other Alarms', icon: '🔔', color: 'var(--text-secondary)', count: unknownCount })
  }

  return (
    <>
      <Topbar title="Alarm Center" subtitle={loading ? "Loading..." : "Real-time alerts and event monitoring"} />
      <div className="page-header">
        <h1 className="page-title">🔔 Alarm Center</h1>
        <p className="page-subtitle">Monitor events from your fleet devices including ADAS & DMS alerts</p>
      </div>

      {/* Alarm type summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {alarmTypes.map(a => (
          <div key={a.id} className="card" style={{ padding: 16, borderLeft: `3px solid ${a.color}`, cursor: 'pointer' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{a.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: a.count > 0 ? a.color : 'var(--text-muted)' }}>{a.count}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{a.name}</div>
          </div>
        ))}
      </div>

      {/* Alarm list */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--bg-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>📋 Recent Alarms</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-alarm">{alarms.length} Total</span>
            <button className="btn btn-secondary btn-sm" onClick={fetchAlarms} disabled={loading}>
              {loading ? '⟳ Refreshing...' : '↻ Refresh'}
            </button>
          </div>
        </div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr><th>Type</th><th>Device IMEI</th><th>Time</th><th>Speed</th><th>Location (Lat/Lng)</th><th>Action</th></tr>
            </thead>
            <tbody>
              {alarms.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No alarms received yet.
                  </td>
                </tr>
              ) : alarms.map((a, i) => {
                const config = ALARM_CONFIGS[a.alarm_type] || { name: a.alarm_name || `Unknown (${a.alarm_type})`, color: 'var(--text-secondary)' }
                return (
                  <tr key={a.id || i}>
                    <td>
                      <span className="badge" style={{ background: `${config.color}15`, color: config.color, border: `1px solid ${config.color}40` }}>
                        {config.name}
                      </span>
                    </td>
                    <td>
                      <div className="mono" style={{ fontWeight: 600 }}>{a.imei}</div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.alarm_time}</td>
                    <td style={{ fontWeight: 600, color: Number(a.speed) > 0 ? 'var(--amber)' : 'var(--text-muted)' }}>{a.speed} km/h</td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200 }}>
                      {a.lat && a.lng ? `${a.lat}, ${a.lng}` : '—'}
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => alert(a.raw_data)}>View JSON</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 20, padding: 16, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--text-secondary)' }}>
        💡 <strong style={{ color: 'var(--cyan)' }}>Push Notifications:</strong> Configure your webhook URL in JIMI platform to receive real-time alarm pushes via <code style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4 }}>jimi.push.device.alarm</code>
      </div>
    </>
  )
}
