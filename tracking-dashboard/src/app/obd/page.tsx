'use client'
import { useState } from 'react'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import type { OBDRecord } from '@/lib/api/types'

function GaugeBar({ value, max, color, label, unit }: { value: number; max: number; color: string; label: string; unit: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginBottom: 4 }}>{value}<span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>{unit}</span></div>
      <div style={{ background: 'var(--bg-elevated)', borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 4 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 99, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  )
}

export default function OBDPage() {
  const { accessToken } = useAuthStore()
  const [imei, setImei] = useState('')
  const [records, setRecords] = useState<OBDRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 86400000).toISOString().slice(0, 10))
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10))

  const latest = records[0]

  async function fetchOBD() {
    if (!accessToken || !imei) return
    setLoading(true)
    try {
      const res = await fetch('/api/obd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, imei, beginTime: `${dateFrom} 00:00:00`, endTime: `${dateTo} 23:59:59` }),
      })
      const json = await res.json()
      if (json.success) setRecords(json.data?.result || [])
    } finally { setLoading(false) }
  }

  return (
    <>
      <Topbar title="OBD Data" subtitle="CAN bus diagnostics and vehicle health" />
      <div className="page-header">
        <h1 className="page-title">🔧 OBD Diagnostics</h1>
        <p className="page-subtitle">Real-time and historical OBD / CAN bus data from your devices</p>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label className="form-label">Device IMEI</label>
          <input className="form-input" placeholder="Enter OBD device IMEI" value={imei} onChange={e => setImei(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Date From</label>
          <input className="form-input" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Date To</label>
          <input className="form-input" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={fetchOBD} disabled={loading || !imei}>
          {loading ? '⟳ Loading...' : '🔍 Query OBD'}
        </button>
      </div>

      {/* Live Gauges */}
      {latest && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title" style={{ marginBottom: 20 }}>⚡ Latest Reading — {latest.dataReportTime}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20 }}>
            <GaugeBar value={Number(latest.currentSpeed)} max={200} color="var(--cyan)" label="Current Speed" unit=" km/h" />
            <GaugeBar value={Number(latest.currentRPM)} max={8000} color="var(--purple)" label="Engine RPM" unit=" rpm" />
            <GaugeBar value={Number(latest.remainingFuelPercentage)} max={100} color="var(--green)" label="Fuel Level" unit="%" />
            <GaugeBar value={Number(latest.coolantTemperature)} max={120} color="var(--amber)" label="Coolant Temp" unit="°C" />
            <GaugeBar value={Number(latest.vehicleBatterVoltage) / 10} max={15} color="var(--cyan)" label="Battery Voltage" unit="V" />
            <GaugeBar value={Number(latest.odometerReading)} max={500000} color="var(--text-secondary)" label="Odometer" unit=" km" />
          </div>
          {latest.vin && (
            <div style={{ marginTop: 20, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', fontSize: 13, display: 'flex', gap: 16 }}>
              <span style={{ color: 'var(--text-muted)' }}>VIN:</span>
              <span className="mono">{latest.vin}</span>
            </div>
          )}
        </div>
      )}

      {/* OBD History Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Time</th><th>Speed</th><th>RPM</th><th>Fuel %</th><th>Coolant</th><th>Voltage</th><th>Odometer</th><th>Mileage</th></tr>
          </thead>
          <tbody>
            {loading ? [...Array(5)].map((_, i) => (
              <tr key={i}>{[...Array(8)].map((_, j) => (
                <td key={j}><div className="skeleton" style={{ height: 14, width: '70%' }} /></td>
              ))}</tr>
            )) : records.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 48 }}>
                {imei ? 'No OBD data found' : 'Enter device IMEI to query OBD data'}
              </td></tr>
            ) : records.map((r, i) => (
              <tr key={i}>
                <td style={{ fontSize: 12 }}>{r.dataReportTime}</td>
                <td style={{ fontWeight: 600, color: Number(r.currentSpeed) > 80 ? 'var(--amber)' : 'var(--text-primary)' }}>{r.currentSpeed} km/h</td>
                <td>{r.currentRPM} rpm</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, background: 'var(--bg-elevated)', borderRadius: 99, height: 4 }}>
                      <div style={{ height: '100%', width: `${r.remainingFuelPercentage}%`, background: Number(r.remainingFuelPercentage) < 20 ? 'var(--red)' : 'var(--green)', borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: 12, minWidth: 30 }}>{r.remainingFuelPercentage}%</span>
                  </div>
                </td>
                <td style={{ color: Number(r.coolantTemperature) > 100 ? 'var(--red)' : 'inherit' }}>{r.coolantTemperature}°C</td>
                <td>{(Number(r.vehicleBatterVoltage)/10).toFixed(1)}V</td>
                <td>{Number(r.odometerReading).toFixed(1)} km</td>
                <td>{r.deviceAccumulatedMileage} km</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
