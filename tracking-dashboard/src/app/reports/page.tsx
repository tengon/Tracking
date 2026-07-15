'use client'
import Topbar from '@/components/layout/Topbar'

export default function ReportsPage() {
  return (
    <>
      <Topbar title="Reports" subtitle="Fleet analytics and performance reports" />
      <div className="page-header">
        <h1 className="page-title">📈 Reports</h1>
        <p className="page-subtitle">Mileage summaries, trip reports, parking analysis, and driver performance</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {[
          { icon: '🛣️', title: 'Mileage Report', desc: 'Total distance per device per period', color: 'var(--cyan)', api: 'jimi.device.track.mileage' },
          { icon: '📜', title: 'Trip Report', desc: 'Individual trip breakdown with speed and duration', color: 'var(--purple)', api: 'jimi.open.platform.report.trips' },
          { icon: '🅿️', title: 'Parking Report', desc: 'Idle and parking durations at locations', color: 'var(--green)', api: 'jimi.open.platform.report.parking' },
          { icon: '🔔', title: 'Alarm Report', desc: 'Summary of all alarm types by device', color: 'var(--red)', api: 'jimi.device.alarm.list' },
          { icon: '🗺️', title: 'Geofence Report', desc: 'Entry/exit events and dwell time', color: 'var(--amber)', api: 'jimi.open.platform.fence.duration' },
          { icon: '🔧', title: 'OBD Report', desc: 'Engine diagnostics and fuel consumption', color: 'var(--purple)', api: 'jimi.device.obd.list' },
        ].map(r => (
          <div key={r.title} className="card" style={{ borderLeft: `3px solid ${r.color}`, cursor: 'pointer', transition: 'var(--transition)' }}>
            <div style={{ fontSize: 32, marginBottom: 14 }}>{r.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{r.title}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>{r.desc}</div>
            <div style={{ fontSize: 10, background: 'var(--bg-elevated)', padding: '4px 8px', borderRadius: 4, fontFamily: 'monospace', color: r.color }}>
              {r.api}
            </div>
            <button className="btn btn-secondary btn-sm" style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}>
              Generate Report →
            </button>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-title">📊 Fleet Summary — Current Week</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16, marginTop: 8 }}>
          {[
            { label: 'Total Distance', value: '12,450 km', color: 'var(--cyan)' },
            { label: 'Active Trips', value: '387', color: 'var(--green)' },
            { label: 'Avg Speed', value: '52 km/h', color: 'var(--purple)' },
            { label: 'Idle Time', value: '14.2 hrs', color: 'var(--amber)' },
            { label: 'Alarms Fired', value: '31', color: 'var(--red)' },
            { label: 'Fuel Saved', value: '~45 L', color: 'var(--green)' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
