'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import Flatpickr from 'react-flatpickr'
import 'flatpickr/dist/themes/dark.css'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts'

type ReportType = 'mileage' | 'trips' | 'parking' | 'alarm' | 'geofence' | 'obd'

interface ReportMeta {
  id: ReportType
  title: string
  icon: string
  desc: string
  api: string
  color: string
}

const REPORT_METAS: ReportMeta[] = [
  {
    id: 'mileage',
    title: '1. Mileage Report',
    icon: '🛣️',
    desc: 'Total distance, moving vs idle time per device',
    api: 'jimi.device.track.mileage',
    color: 'var(--cyan)'
  },
  {
    id: 'trips',
    title: '2. Trip Report',
    icon: '📜',
    desc: 'Individual trip breakdown with start/end locations and speeds',
    api: 'jimi.open.platform.report.trips',
    color: 'var(--purple)'
  },
  {
    id: 'parking',
    title: '3. Parking Report',
    icon: '🅿️',
    desc: 'Idle and parking durations at specific locations',
    api: 'jimi.open.platform.report.parking',
    color: 'var(--green)'
  },
  {
    id: 'alarm',
    title: '4. Alarm Report',
    icon: '🔔',
    desc: 'Security alerts, overspeed, SOS, and geofence alarms',
    api: 'jimi.device.alarm.list',
    color: 'var(--red)'
  },
  {
    id: 'geofence',
    title: '5. Geofence Report',
    icon: '🗺️',
    desc: 'Entry/exit events and dwell duration inside geofence zones',
    api: 'jimi.open.platform.fence.duration',
    color: 'var(--amber)'
  },
  {
    id: 'obd',
    title: '6. OBD Report',
    icon: '🔧',
    desc: 'Engine diagnostics, RPM, coolant temp, fuel, battery',
    api: 'jimi.device.obd.list',
    color: 'var(--blue)'
  }
]

export default function ReportsPage() {
  const { accessToken, contextAccount } = useAuthStore()
  const [selectedReport, setSelectedReport] = useState<ReportType>('mileage')
  const [selectedImei, setSelectedImei] = useState<string>('')
  const [targetAccount, setTargetAccount] = useState<string>('')

  // Date Filters
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d.toISOString().slice(0, 10) + ' 00:00:00'
  })

  const [dateTo, setDateTo] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10) + ' 23:59:59'
  })

  // Specific report filters
  const [accType, setAccType] = useState<'off' | 'on'>('off')
  const [fenceId, setFenceId] = useState<string>('')

  // State
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [syncResult, setSyncResult] = useState<{ saved: number; fetched: number; error?: string } | null>(null)
  const [seedStatus, setSeedStatus] = useState<any | null>(null)
  const [reportData, setReportData] = useState<any[]>([])
  const [dataSource, setDataSource] = useState<'live' | 'db' | 'empty' | null>(null)
  const [queryMessage, setQueryMessage] = useState<string | null>(null)
  const [tableSearch, setTableSearch] = useState('')
  // Real device list from PostgreSQL / Jimi API
  const [devices, setDevices] = useState<{ imei: string; device_name: string | null }[]>([])

  useEffect(() => {
    if (contextAccount) {
      setTargetAccount(contextAccount)
    }
  }, [contextAccount])

  // Load real device list from PostgreSQL
  useEffect(() => {
    const acct = targetAccount || contextAccount || '754269'
    fetch(`/api/sync/devices?account=${encodeURIComponent(acct)}`)
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setDevices(json.data.map((d: any) => ({
            imei: d.imei,
            device_name: d.device_name || d.deviceName || d.imei,
          })))
        }
      })
      .catch(() => { /* silently ignore if DB not ready */ })
  }, [targetAccount, contextAccount])

  // Quick Date Range Presets
  const setQuickRange = (range: 'today' | 'yesterday' | 'week' | 'month') => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fmt = (d: Date, endOfDay = false) => {
      const datePart = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      return `${datePart} ${endOfDay ? '23:59:59' : '00:00:00'}`
    }

    if (range === 'today') {
      setDateFrom(fmt(now, false))
      setDateTo(fmt(now, true))
    } else if (range === 'yesterday') {
      const y = new Date(now)
      y.setDate(y.getDate() - 1)
      setDateFrom(fmt(y, false))
      setDateTo(fmt(y, true))
    } else if (range === 'week') {
      const w = new Date(now)
      w.setDate(w.getDate() - 7)
      setDateFrom(fmt(w, false))
      setDateTo(fmt(now, true))
    } else if (range === 'month') {
      const m = new Date(now)
      m.setMonth(m.getMonth() - 1)
      setDateFrom(fmt(m, false))
      setDateTo(fmt(now, true))
    }
  }

  // Fetch Report Data
  const generateReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          account: targetAccount || 'bitauto',
          reportType: selectedReport,
          imei: selectedImei,
          imeis: selectedImei ? [selectedImei] : [],
          beginTime: dateFrom,
          endTime: dateTo,
          accType,
          fenceId
        })
      })

      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setReportData(json.data)
        setDataSource(json.source || null)
        setQueryMessage(json.message || (json.data.length === 0 ? 'Tidak ada record data ditemukan.' : null))
      } else {
        setReportData([])
        setDataSource('empty')
        setQueryMessage(json.error || 'Tidak ada record data ditemukan.')
      }
    } catch (err: any) {
      console.error('Failed to generate report:', err)
      setReportData([])
      setDataSource('empty')
      setQueryMessage('Gagal mengambil data dari server.')
    } finally {
      setLoading(false)
    }
  }, [accessToken, targetAccount, selectedReport, selectedImei, dateFrom, dateTo, accType, fenceId])

  // Sync & Save — fetch from Jimi API and persist to PostgreSQL
  const syncAndSave = useCallback(async () => {
    if (!accessToken) return
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/reports/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          account: targetAccount || 'bitauto',
          reportType: selectedReport,
          imei: selectedImei,
          imeis: selectedImei ? [selectedImei] : [],
          beginTime: dateFrom,
          endTime: dateTo,
          accType,
          fenceId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setSyncResult({ saved: json.saved ?? 0, fetched: json.fetched ?? 0, error: json.apiError })
        // Refresh table from DB after save
        await generateReport()
      } else {
        setSyncResult({ saved: 0, fetched: 0, error: json.error })
      }
    } catch (err: any) {
      setSyncResult({ saved: 0, fetched: 0, error: err.message })
    } finally {
      setSyncing(false)
    }
  }, [accessToken, targetAccount, selectedReport, selectedImei, dateFrom, dateTo, accType, fenceId, generateReport])

  // Seed All — login tengon, fetch all 6 reports, save to PostgreSQL
  const seedAllReports = useCallback(async () => {
    setSeeding(true)
    setSeedStatus(null)
    try {
      const res = await fetch('/api/reports/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 7 }),
      })
      const json = await res.json()
      setSeedStatus(json)
      if (json.success) {
        // Refresh the active report table from DB
        await generateReport()
      }
    } catch (err: any) {
      setSeedStatus({ success: false, error: err.message })
    } finally {
      setSeeding(false)
    }
  }, [generateReport])

  // Initial report load
  useEffect(() => {
    generateReport()
  }, [selectedReport])

  // Filtered Table Data
  const filteredData = useMemo(() => {
    if (!tableSearch.trim()) return reportData
    const q = tableSearch.toLowerCase()
    return reportData.filter(item => JSON.stringify(item).toLowerCase().includes(q))
  }, [reportData, tableSearch])

  // Export CSV Handler
  const exportCSV = () => {
    if (!filteredData.length) return
    const keys = Object.keys(filteredData[0])
    const header = keys.join(',')
    const rows = filteredData.map(row =>
      keys.map(k => {
        const val = row[k] ?? ''
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val
      }).join(',')
    )
    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `${selectedReport}_report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Active Report Metadata
  const activeMeta = REPORT_METAS.find(r => r.id === selectedReport)!

  // Stats calculation
  const stats = useMemo(() => {
    if (!reportData.length) return []
    if (selectedReport === 'mileage') {
      const totalDist = reportData.reduce((sum, r) => sum + (r.totalMileage || 0), 0)
      const totalIdle = reportData.reduce((sum, r) => sum + (r.idleTime || 0), 0)
      const maxSpeed = Math.max(...reportData.map(r => r.maxSpeed || 0), 0)
      const fuelTotal = reportData.reduce((sum, r) => sum + (r.fuelConsumed || 0), 0)
      return [
        { label: 'Total Distance', val: `${totalDist.toFixed(1)} km`, color: 'var(--cyan)' },
        { label: 'Total Idle Time', val: `${totalIdle} mins`, color: 'var(--amber)' },
        { label: 'Max Speed', val: `${maxSpeed} km/h`, color: 'var(--purple)' },
        { label: 'Fuel Consumed', val: `~${fuelTotal.toFixed(1)} L`, color: 'var(--green)' }
      ]
    } else if (selectedReport === 'trips') {
      const totalDist = reportData.reduce((sum, r) => sum + (r.distance || 0), 0)
      const avgDuration = Math.round(reportData.reduce((sum, r) => sum + (r.duration || 0), 0) / reportData.length)
      const maxSpeed = Math.max(...reportData.map(r => r.maxSpeed || 0), 0)
      return [
        { label: 'Total Trips', val: `${reportData.length}`, color: 'var(--purple)' },
        { label: 'Combined Distance', val: `${totalDist.toFixed(1)} km`, color: 'var(--cyan)' },
        { label: 'Avg Trip Duration', val: `${avgDuration} mins`, color: 'var(--amber)' },
        { label: 'Peak Speed', val: `${maxSpeed} km/h`, color: 'var(--red)' }
      ]
    } else if (selectedReport === 'parking') {
      const totalParkingMinutes = reportData.reduce((sum, r) => sum + (r.durationMinutes || 0), 0)
      const accOnCount = reportData.filter(r => r.accStatus === 'ON').length
      return [
        { label: 'Parking Events', val: `${reportData.length}`, color: 'var(--green)' },
        { label: 'Total Parked Time', val: `${(totalParkingMinutes / 60).toFixed(1)} hrs`, color: 'var(--cyan)' },
        { label: 'ACC ON Idling', val: `${accOnCount} events`, color: 'var(--amber)' },
        { label: 'Avg Parking Duration', val: `${Math.round(totalParkingMinutes / reportData.length)} mins`, color: 'var(--purple)' }
      ]
    } else if (selectedReport === 'alarm') {
      const criticalCount = reportData.filter(r => r.severity === 'Critical').length
      const warningCount = reportData.filter(r => r.severity === 'Warning').length
      return [
        { label: 'Total Alarms', val: `${reportData.length}`, color: 'var(--red)' },
        { label: 'Critical Severity', val: `${criticalCount}`, color: 'var(--pink)' },
        { label: 'Warnings', val: `${warningCount}`, color: 'var(--amber)' },
        { label: 'Info Alerts', val: `${reportData.length - criticalCount - warningCount}`, color: 'var(--cyan)' }
      ]
    } else if (selectedReport === 'geofence') {
      const totalDwell = reportData.reduce((sum, r) => sum + (r.dwellMinutes || 0), 0)
      return [
        { label: 'Fence Duration Records', val: `${reportData.length}`, color: 'var(--amber)' },
        { label: 'Total Dwell Time', val: `${(totalDwell / 60).toFixed(1)} hrs`, color: 'var(--cyan)' },
        { label: 'Avg Dwell Duration', val: `${Math.round(totalDwell / reportData.length)} mins`, color: 'var(--green)' },
        { label: 'Active Fences', val: `${new Set(reportData.map(r => r.fenceName)).size}`, color: 'var(--purple)' }
      ]
    } else if (selectedReport === 'obd') {
      const dtcCount = reportData.reduce((sum, r) => sum + (r.dtcCount || 0), 0)
      const avgFuel = Math.round(reportData.reduce((sum, r) => sum + (r.fuelLevel || 0), 0) / reportData.length)
      const avgTemp = Math.round(reportData.reduce((sum, r) => sum + (r.coolantTemp || 0), 0) / reportData.length)
      return [
        { label: 'OBD Diagnostics Logs', val: `${reportData.length}`, color: 'var(--blue)' },
        { label: 'Avg Fuel Level', val: `${avgFuel}%`, color: 'var(--green)' },
        { label: 'Avg Coolant Temp', val: `${avgTemp} °C`, color: 'var(--amber)' },
        { label: 'DTC Fault Codes', val: `${dtcCount}`, color: dtcCount > 0 ? 'var(--red)' : 'var(--cyan)' }
      ]
    }
    return []
  }, [reportData, selectedReport])

  return (
    <>
      <Topbar title="Fleet Analytics & Reports" subtitle="Generate detailed Jimi IoT platform reports" />

      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <h1 className="page-title">📈 Fleet Reports Hub</h1>
        <p className="page-subtitle">
          Official Jimi IoT API reports: Mileage, Trip, Parking, Alarm, Geofence, and OBD diagnostics
        </p>
      </div>

      {/* Tengon Seed Panel */}
      <div className="card" style={{
        marginBottom: 20,
        borderLeft: '4px solid var(--cyan)',
        background: 'linear-gradient(135deg, rgba(0,245,255,0.04) 0%, rgba(0,128,255,0.04) 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>🌐</span>
              <span style={{ fontWeight: 700, fontSize: 15 }}>Fetch All Reports from Jimi API → PostgreSQL</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Auto-login <span style={{ color: 'var(--cyan)', fontFamily: 'monospace' }}>account: 754269</span> · Ambil data 7 hari terakhir · Simpan ke 6 tabel
              <span style={{ fontFamily: 'monospace', marginLeft: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                rpt_mileage / rpt_trips / rpt_parking / rpt_alarms / rpt_geofence_duration / rpt_obd
              </span>
            </div>
          </div>
          <button
            onClick={seedAllReports}
            disabled={seeding}
            style={{
              padding: '10px 22px',
              borderRadius: 'var(--r-md)',
              fontWeight: 700,
              fontSize: 13,
              cursor: seeding ? 'not-allowed' : 'pointer',
              background: seeding ? 'rgba(0,245,255,0.08)' : 'linear-gradient(135deg, rgba(0,245,255,0.2), rgba(0,128,255,0.2))',
              border: '1px solid rgba(0,245,255,0.4)',
              color: 'var(--cyan)',
              transition: 'var(--transition)',
              whiteSpace: 'nowrap',
            }}
          >
            {seeding ? '⟳ Fetching & Saving...' : '🌐 Fetch All & Seed DB'}
          </button>
        </div>

        {/* Seed Result */}
        {seedStatus && (
          <div style={{
            marginTop: 14,
            padding: '12px 16px',
            borderRadius: 'var(--r-md)',
            background: seedStatus.success ? 'rgba(0,255,65,0.07)' : 'rgba(255,0,64,0.1)',
            border: `1px solid ${seedStatus.success ? 'rgba(0,255,65,0.25)' : 'rgba(255,0,64,0.3)'}`,
            fontSize: 12,
          }}>
            {seedStatus.success ? (
              <>
                <div style={{ color: 'var(--green)', fontWeight: 700, marginBottom: 8 }}>
                  ✅ Seed complete — Account: {seedStatus.account} · {seedStatus.devices} devices · {seedStatus.totalFetched} records fetched · {seedStatus.totalSaved} saved
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {seedStatus.summary && Object.entries(seedStatus.summary).map(([type, stat]: [string, any]) => (
                    <span key={type} style={{
                      padding: '3px 10px',
                      borderRadius: 8,
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--bg-border)',
                      color: stat.error ? 'var(--amber)' : 'var(--text-secondary)',
                      fontFamily: 'monospace',
                      fontSize: 11,
                    }}>
                      {type}: {stat.fetched}↓ {stat.saved}💾{stat.error ? ` ⚠` : ''}
                    </span>
                  ))}
                </div>
                {seedStatus.warnings?.length > 0 && (
                  <div style={{ marginTop: 8, color: 'var(--amber)', fontSize: 11 }}>
                    ⚠ {seedStatus.warnings.join(' · ')}
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--red)' }}>❌ {seedStatus.error || 'Seed failed'}</div>
            )}
            <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 11 }}>
              Date range: {seedStatus.dateRange?.beginTime} → {seedStatus.dateRange?.endTime}
            </div>
          </div>
        )}
      </div>

      {/* 6 Report Selector Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        {REPORT_METAS.map(r => {
          const isSelected = selectedReport === r.id
          return (
            <div
              key={r.id}
              onClick={() => setSelectedReport(r.id)}
              className="card"
              style={{
                borderLeft: `4px solid ${r.color}`,
                cursor: 'pointer',
                transition: 'var(--transition)',
                background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-card)',
                boxShadow: isSelected ? `0 0 16px rgba(0,245,255,0.15), 0 0 0 1px ${r.color}` : 'var(--shadow-card)',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 32 }}>{r.icon}</span>
                {isSelected && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, background: r.color, color: '#000' }}>
                    ACTIVE
                  </span>
                )}
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {r.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, minHeight: 36 }}>
                {r.desc}
              </div>
              <div style={{
                fontSize: 11,
                background: 'var(--bg-base)',
                padding: '4px 8px',
                borderRadius: 4,
                fontFamily: 'monospace',
                color: r.color,
                border: '1px solid var(--bg-border)',
                display: 'inline-block'
              }}>
                {r.api}
              </div>
            </div>
          )
        })}
      </div>

      {/* Controls & Filter Bar */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>⚙️</span>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
              Report Filters — <span style={{ color: activeMeta.color }}>{activeMeta.title}</span>
            </h3>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['today', 'yesterday', 'week', 'month'] as const).map(preset => (
              <button
                key={preset}
                className="btn btn-secondary btn-sm"
                onClick={() => setQuickRange(preset)}
                style={{ textTransform: 'capitalize', fontSize: 11, padding: '4px 10px' }}
              >
                {preset === 'week' ? 'Last 7 Days' : preset === 'month' ? 'This Month' : preset}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, alignItems: 'flex-end' }}>
          {/* Target Device */}
          <div className="form-group">
            <label className="form-label">Select Device (IMEI)</label>
            <select
              className="form-input"
              value={selectedImei}
              onChange={e => setSelectedImei(e.target.value)}
            >
              <option value="">All Active Fleet Devices</option>
              {devices.length > 0
                ? devices.map(dev => (
                    <option key={dev.imei} value={dev.imei}>
                      {dev.device_name} ({dev.imei})
                    </option>
                  ))
                : <option disabled>Loading devices...</option>
              }
            </select>
          </div>

          {/* Date From */}
          <div className="form-group">
            <label className="form-label">Start Time (UTC+7)</label>
            <Flatpickr
              className="form-input"
              options={{ enableTime: true, dateFormat: "Y-m-d H:i:S", time_24hr: true }}
              value={dateFrom}
              onChange={([date]) => {
                if (date) {
                  const pad = (n: number) => String(n).padStart(2, '0')
                  const formatted = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
                  setDateFrom(formatted)
                }
              }}
            />
          </div>

          {/* Date To */}
          <div className="form-group">
            <label className="form-label">End Time (UTC+7)</label>
            <Flatpickr
              className="form-input"
              options={{ enableTime: true, dateFormat: "Y-m-d H:i:S", time_24hr: true }}
              value={dateTo}
              onChange={([date]) => {
                if (date) {
                  const pad = (n: number) => String(n).padStart(2, '0')
                  const formatted = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
                  setDateTo(formatted)
                }
              }}
            />
          </div>

          {/* Specific Filters */}
          {selectedReport === 'parking' && (
            <div className="form-group">
              <label className="form-label">ACC Engine Status</label>
              <select className="form-input" value={accType} onChange={e => setAccType(e.target.value as any)}>
                <option value="off">Engine OFF (Parking)</option>
                <option value="on">Engine ON (Idling)</option>
              </select>
            </div>
          )}

          {selectedReport === 'geofence' && (
            <div className="form-group">
              <label className="form-label">Geofence Zone</label>
              <input
                className="form-input"
                placeholder="All zones (or fence ID)"
                value={fenceId}
                onChange={e => setFenceId(e.target.value)}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={generateReport}
              disabled={loading || syncing}
              style={{ flex: '1 1 120px' }}
            >
              {loading ? '⟳ Loading...' : '🔍 Query Report'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={syncAndSave}
              disabled={syncing || loading || !accessToken}
              title={!accessToken ? 'Login required to sync from Jimi API' : 'Fetch from Jimi API and save to PostgreSQL'}
              style={{
                flex: '1 1 140px',
                background: syncing ? 'rgba(0,255,65,0.1)' : 'rgba(0,255,65,0.08)',
                borderColor: 'rgba(0,255,65,0.4)',
                color: 'var(--green)',
              }}
            >
              {syncing ? '⟳ Syncing...' : '💾 Sync & Save to DB'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={exportCSV}
              disabled={!reportData.length}
              title="Export CSV"
            >
              📥 CSV
            </button>
          </div>

          {/* Query Result Status Notification Banner */}
          {queryMessage && (
            <div style={{
              gridColumn: '1 / -1',
              marginTop: 6,
              padding: '10px 14px',
              borderRadius: 'var(--r-md)',
              fontSize: 12.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: reportData.length === 0
                ? 'rgba(255, 176, 32, 0.12)'
                : dataSource === 'live'
                ? 'rgba(0, 255, 65, 0.10)'
                : 'rgba(0, 128, 255, 0.10)',
              border: `1px solid ${
                reportData.length === 0
                  ? 'rgba(255, 176, 32, 0.35)'
                  : dataSource === 'live'
                  ? 'rgba(0, 255, 65, 0.35)'
                  : 'rgba(0, 128, 255, 0.35)'
              }`,
              color: reportData.length === 0
                ? 'var(--amber)'
                : dataSource === 'live'
                ? 'var(--green)'
                : 'var(--blue)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{reportData.length === 0 ? '⚠️' : dataSource === 'live' ? '⚡' : '🗄️'}</span>
                <span>{queryMessage}</span>
              </div>
              <button
                onClick={() => setQueryMessage(null)}
                style={{ background: 'transparent', color: 'inherit', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Sync Result Toast */}
          {syncResult && (
            <div style={{
              gridColumn: '1 / -1',
              marginTop: 4,
              padding: '8px 14px',
              borderRadius: 'var(--r-md)',
              fontSize: 12,
              background: syncResult.error && !syncResult.saved
                ? 'rgba(255,0,64,0.12)'
                : 'rgba(0,255,65,0.10)',
              border: `1px solid ${syncResult.error && !syncResult.saved ? 'rgba(255,0,64,0.3)' : 'rgba(0,255,65,0.3)'}`,
              color: syncResult.error && !syncResult.saved ? 'var(--red)' : 'var(--green)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span>
                {syncResult.error && !syncResult.saved
                  ? `⚠️ Sync failed: ${syncResult.error}`
                  : `✅ Synced — ${syncResult.fetched} records fetched, ${syncResult.saved} saved to PostgreSQL`}
                {syncResult.error && syncResult.saved > 0 && (
                  <span style={{ color: 'var(--amber)', marginLeft: 8 }}>(⚠ API warn: {syncResult.error})</span>
                )}
              </span>
              <button
                onClick={() => setSyncResult(null)}
                style={{ background: 'transparent', color: 'inherit', fontSize: 14, padding: '0 4px' }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      {stats.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
          {stats.map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 20px', borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color, fontFamily: 'monospace' }}>
                {s.val}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visual Charts Section */}
      {reportData.length > 0 && (
        <div className="card" style={{ marginBottom: 24, padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>
              📊 Visual Analytics & Trend Chart
            </h3>
            {dataSource && dataSource !== 'empty' && (
              <span style={{
                fontSize: 11,
                padding: '3px 12px',
                borderRadius: 12,
                fontWeight: 600,
                background: dataSource === 'live'
                  ? 'rgba(0,255,65,0.15)'
                  : 'rgba(0,128,255,0.15)',
                color: dataSource === 'live'
                  ? 'var(--green)'
                  : 'var(--blue)',
                border: `1px solid ${
                  dataSource === 'live'
                    ? 'rgba(0,255,65,0.35)'
                    : 'rgba(0,128,255,0.35)'
                }`
              }}>
                {dataSource === 'live'
                  ? '⚡ LIVE — Jimi IoT API'
                  : '🗄️ CACHED — PostgreSQL DB'}
              </span>
            )}
          </div>

          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              {selectedReport === 'mileage' ? (
                <BarChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--bg-border)', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="totalMileage" name="Mileage (km)" fill="var(--cyan)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fuelConsumed" name="Fuel (L)" fill="var(--purple)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : selectedReport === 'trips' ? (
                <BarChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="tripId" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--bg-border)', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="distance" name="Distance (km)" fill="var(--purple)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgSpeed" name="Avg Speed (km/h)" fill="var(--cyan)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : selectedReport === 'parking' ? (
                <BarChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="parkingId" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--bg-border)', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="durationMinutes" name="Parking Duration (mins)" fill="var(--green)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : selectedReport === 'alarm' ? (
                <BarChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="alarmCode" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--bg-border)', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="speed" name="Speed at Alarm (km/h)" fill="var(--red)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : selectedReport === 'geofence' ? (
                <BarChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="fenceName" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--bg-border)', color: '#fff' }} />
                  <Legend />
                  <Bar dataKey="dwellMinutes" name="Dwell Time (mins)" fill="var(--amber)" radius={[4, 4, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={reportData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                  <XAxis dataKey="timestamp" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-elevated)', borderColor: 'var(--bg-border)', color: '#fff' }} />
                  <Legend />
                  <Line type="monotone" dataKey="rpm" name="Engine RPM" stroke="var(--blue)" strokeWidth={2} />
                  <Line type="monotone" dataKey="coolantTemp" name="Coolant Temp (°C)" stroke="var(--amber)" strokeWidth={2} />
                  <Line type="monotone" dataKey="speed" name="Speed (km/h)" stroke="var(--cyan)" strokeWidth={2} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Detailed Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--bg-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>
              📋 Detailed {activeMeta.title} Records ({filteredData.length})
            </h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              API Method: {activeMeta.api}
            </span>
          </div>

          <div style={{ width: 260 }}>
            <input
              className="form-input"
              placeholder="🔎 Search in table..."
              value={tableSearch}
              onChange={e => setTableSearch(e.target.value)}
              style={{ fontSize: 12, padding: '6px 12px' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--bg-border)' }}>
                <th style={{ padding: '12px 16px' }}>#</th>
                <th style={{ padding: '12px 16px' }}>Device Name / IMEI</th>
                {selectedReport === 'mileage' && (
                  <>
                    <th style={{ padding: '12px 16px' }}>Date</th>
                    <th style={{ padding: '12px 16px' }}>Mileage (km)</th>
                    <th style={{ padding: '12px 16px' }}>Moving Time</th>
                    <th style={{ padding: '12px 16px' }}>Idle Time</th>
                    <th style={{ padding: '12px 16px' }}>Avg / Max Speed</th>
                    <th style={{ padding: '12px 16px' }}>Est. Fuel</th>
                  </>
                )}

                {selectedReport === 'trips' && (
                  <>
                    <th style={{ padding: '12px 16px' }}>Trip ID</th>
                    <th style={{ padding: '12px 16px' }}>Start Time & Address</th>
                    <th style={{ padding: '12px 16px' }}>End Time & Address</th>
                    <th style={{ padding: '12px 16px' }}>Distance</th>
                    <th style={{ padding: '12px 16px' }}>Duration</th>
                    <th style={{ padding: '12px 16px' }}>Avg / Max Speed</th>
                  </>
                )}

                {selectedReport === 'parking' && (
                  <>
                    <th style={{ padding: '12px 16px' }}>Parking Start</th>
                    <th style={{ padding: '12px 16px' }}>Parking End</th>
                    <th style={{ padding: '12px 16px' }}>Duration</th>
                    <th style={{ padding: '12px 16px' }}>ACC Status</th>
                    <th style={{ padding: '12px 16px' }}>Location Address</th>
                  </>
                )}

                {selectedReport === 'alarm' && (
                  <>
                    <th style={{ padding: '12px 16px' }}>Alarm Type</th>
                    <th style={{ padding: '12px 16px' }}>Time</th>
                    <th style={{ padding: '12px 16px' }}>Severity</th>
                    <th style={{ padding: '12px 16px' }}>Speed</th>
                    <th style={{ padding: '12px 16px' }}>Location</th>
                  </>
                )}

                {selectedReport === 'geofence' && (
                  <>
                    <th style={{ padding: '12px 16px' }}>Fence Name</th>
                    <th style={{ padding: '12px 16px' }}>Enter Time</th>
                    <th style={{ padding: '12px 16px' }}>Exit Time</th>
                    <th style={{ padding: '12px 16px' }}>Dwell Duration</th>
                    <th style={{ padding: '12px 16px' }}>Alert Type</th>
                  </>
                )}

                {selectedReport === 'obd' && (
                  <>
                    <th style={{ padding: '12px 16px' }}>Report Time</th>
                    <th style={{ padding: '12px 16px' }}>Odometer</th>
                    <th style={{ padding: '12px 16px' }}>Fuel Level</th>
                    <th style={{ padding: '12px 16px' }}>Coolant Temp</th>
                    <th style={{ padding: '12px 16px' }}>Battery</th>
                    <th style={{ padding: '12px 16px' }}>RPM & Speed</th>
                    <th style={{ padding: '12px 16px' }}>DTC Faults</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--amber)' }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                      {loading ? '⟳ Memeriksa data di server Jimi IoT...' : 'Tidak ada record data ditemukan'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {!loading && 'Tidak ada record data pada server  untuk filter dan periode waktu ini.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid var(--bg-border)',
                      transition: 'var(--transition)',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                    }}
                  >
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{row.deviceName || 'GPS Tracker'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {row.imei}
                      </div>
                    </td>

                    {/* Mileage */}
                    {selectedReport === 'mileage' && (
                      <>
                        <td style={{ padding: '12px 16px' }}>{row.date || row.startTime?.slice(0, 10)}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--cyan)' }}>
                          {(row.totalMileage || row.distance || 0).toFixed(1)} km
                        </td>
                        <td style={{ padding: '12px 16px' }}>{row.runTime || 0} mins</td>
                        <td style={{ padding: '12px 16px', color: 'var(--amber)' }}>{row.idleTime || 0} mins</td>
                        <td style={{ padding: '12px 16px' }}>{row.avgSpeed || 0} / {row.maxSpeed || 0} km/h</td>
                        <td style={{ padding: '12px 16px', color: 'var(--green)' }}>{row.fuelConsumed ? `${row.fuelConsumed} L` : '-'}</td>
                      </>
                    )}

                    {/* Trips */}
                    {selectedReport === 'trips' && (
                      <>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: 'var(--purple)' }}>
                          {row.tripId || `TRIP-${idx + 1}`}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 12 }}>{row.startTime}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {row.startAddress || 'Start location'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: 12 }}>{row.endTime}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>🏁 {row.endAddress || 'End location'}</div>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--cyan)' }}>
                          {(row.distance || 0).toFixed(1)} km
                        </td>
                        <td style={{ padding: '12px 16px' }}>{row.duration} mins</td>
                        <td style={{ padding: '12px 16px' }}>{row.avgSpeed} / {row.maxSpeed} km/h</td>
                      </>
                    )}

                    {/* Parking */}
                    {selectedReport === 'parking' && (
                      <>
                        <td style={{ padding: '12px 16px' }}>{row.startTime}</td>
                        <td style={{ padding: '12px 16px' }}>{row.endTime}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--green)' }}>
                          {row.durationMinutes || row.durSecond ? `${Math.round((Number(row.durSecond) || (row.durationMinutes * 60)) / 60)} mins` : '-'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: row.accStatus === 'ON' ? 'rgba(255,176,32,0.2)' : 'rgba(0,255,65,0.15)',
                            color: row.accStatus === 'ON' ? 'var(--amber)' : 'var(--green)'
                          }}>
                            ACC {row.accStatus || 'OFF'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          📍 {row.address || row.addr || 'Parking Location'}
                        </td>
                      </>
                    )}

                    {/* Alarm */}
                    {selectedReport === 'alarm' && (
                      <>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--red)' }}>
                          🚨 {row.alarmType || row.alarmCode}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{row.alarmTime}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: row.severity === 'Critical' ? 'rgba(255,0,64,0.2)' : row.severity === 'Warning' ? 'rgba(255,176,32,0.2)' : 'rgba(0,245,255,0.2)',
                            color: row.severity === 'Critical' ? 'var(--red)' : row.severity === 'Warning' ? 'var(--amber)' : 'var(--cyan)'
                          }}>
                            {row.severity || 'Warning'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>{row.speed ? `${row.speed} km/h` : '-'}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                          📍 {row.address || 'Alarm location'}
                        </td>
                      </>
                    )}

                    {/* Geofence */}
                    {selectedReport === 'geofence' && (
                      <>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--amber)' }}>
                          🗺️ {row.fenceName || row.fenceId}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{row.enterTime}</td>
                        <td style={{ padding: '12px 16px' }}>{row.exitTime}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--cyan)' }}>
                          {row.dwellMinutes} mins
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'var(--bg-elevated)', border: '1px solid var(--bg-border)' }}>
                            {row.alertType || 'BOTH'}
                          </span>
                        </td>
                      </>
                    )}

                    {/* OBD */}
                    {selectedReport === 'obd' && (
                      <>
                        <td style={{ padding: '12px 16px' }}>{row.timestamp || row.dataReportTime}</td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace' }}>
                          {row.odometer || row.odometerReading || row.deviceAccumulatedMileage} km
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--green)' }}>
                          {row.fuelLevel || row.remainingFuelPercentage}%
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--amber)' }}>
                          {row.coolantTemp || row.coolantTemperature} °C
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {row.batteryVoltage || row.vehicleBatterVoltage} V
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {row.rpm || row.currentRPM} RPM / {row.speed || row.currentSpeed} km/h
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 700,
                            background: (row.dtcCount || 0) > 0 ? 'rgba(255,0,64,0.2)' : 'rgba(0,255,65,0.15)',
                            color: (row.dtcCount || 0) > 0 ? 'var(--red)' : 'var(--green)'
                          }}>
                            {row.dtcCount || 0} DTC
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
