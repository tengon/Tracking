'use client'
import Topbar from '@/components/layout/Topbar'

const alarmTypes = [
  { id: '1', name: 'SOS Alert', icon: '🚨', color: 'var(--red)', count: 3 },
  { id: '2', name: 'Speeding', icon: '⚡', color: 'var(--amber)', count: 7 },
  { id: '3', name: 'Geofence In/Out', icon: '🗺️', color: 'var(--purple)', count: 4 },
  { id: '4', name: 'Low Battery', icon: '🔋', color: 'var(--amber)', count: 2 },
  { id: '5', name: 'ACC On/Off', icon: '🔑', color: 'var(--cyan)', count: 12 },
  { id: '6', name: 'Harsh Braking', icon: '🛑', color: 'var(--red)', count: 1 },
  { id: '7', name: 'Collision (DVR)', icon: '💥', color: 'var(--red)', count: 0 },
  { id: '8', name: 'Distraction (DMS)', icon: '😴', color: 'var(--amber)', count: 2 },
]

const recentAlarms = [
  { type: 'Speeding', device: 'JC450Pro-01739', imei: '869247060001739', time: '2026-07-14 18:32:00', speed: '98 km/h', addr: 'Jl. Sudirman, Jakarta', color: 'var(--amber)' },
  { type: 'SOS Alert', device: 'VL802-69660', imei: '860121060369660', time: '2026-07-14 17:55:00', speed: '—', addr: 'Jl. MH Thamrin, Jakarta', color: 'var(--red)' },
  { type: 'Geofence Exit', device: 'GT300L-3604', imei: '868120145233604', time: '2026-07-14 16:10:00', speed: '45 km/h', addr: 'Tangerang, Banten', color: 'var(--purple)' },
  { type: 'Low Battery', device: 'VL802-69660', imei: '860121060369660', time: '2026-07-14 14:20:00', speed: '—', addr: '—', color: 'var(--amber)' },
  { type: 'Distraction Alert (DMS)', device: 'JC450Pro-01739', imei: '869247060001739', time: '2026-07-14 13:05:00', speed: '60 km/h', addr: 'Tol Jagorawi Km 12', color: 'var(--red)' },
]

export default function AlarmsPage() {
  return (
    <>
      <Topbar title="Alarm Center" subtitle="Real-time alerts and event monitoring" />
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
            <span className="badge badge-alarm">31 Total</span>
            <button className="btn btn-secondary btn-sm">↻ Refresh</button>
          </div>
        </div>
        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
          <table>
            <thead>
              <tr><th>Type</th><th>Device</th><th>Time</th><th>Speed</th><th>Location</th><th>Action</th></tr>
            </thead>
            <tbody>
              {recentAlarms.map((a, i) => (
                <tr key={i}>
                  <td>
                    <span className="badge" style={{ background: `${a.color}15`, color: a.color, border: `1px solid ${a.color}40` }}>
                      {a.type}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.device}</div>
                    <div className="mono">{a.imei}</div>
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.time}</td>
                  <td style={{ fontWeight: 600, color: a.speed !== '—' ? 'var(--amber)' : 'var(--text-muted)' }}>{a.speed}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200 }}>{a.addr}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm">View</button>
                  </td>
                </tr>
              ))}
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
