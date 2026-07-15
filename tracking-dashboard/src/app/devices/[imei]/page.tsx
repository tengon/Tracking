'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import type { Device, DeviceLocation } from '@/lib/api/types'
import { mockDevices, mockLocations } from '@/lib/api/mockData'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const LiveMapComponent = dynamic(() => import('@/components/map/LiveMap'), { ssr: false, loading: () => (
  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)' }}>
    <span style={{ color: 'var(--text-muted)' }}>🗺️ Loading map...</span>
  </div>
)})

export default function DeviceDetailPage() {
  const { imei } = useParams() as { imei: string }
  const router = useRouter()
  const { accessToken, account } = useAuthStore()
  const [device, setDevice] = useState<Device | null>(null)
  const [location, setLocation] = useState<DeviceLocation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!accessToken || !account || !imei) return

    async function loadData() {
      try {
        // Fetch detail
        const devRes = await fetch('/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, action: 'detail', imei }),
        })
        const devJson = await devRes.json()
        
        // Fetch location
        const locRes = await fetch('/api/location', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, target: account, imeis: imei }),
        })
        const locJson = await locRes.json()

        if (devJson.success && devJson.data) {
          setDevice(devJson.data)
        } else {
          // Fallback to mock
          const mockD = mockDevices.find(d => d.imei === imei)
          if (mockD) setDevice(mockD)
        }

        if (locJson.success && locJson.data?.[0]) {
          setLocation(locJson.data[0])
        } else {
          // Fallback to mock
          const mockL = mockLocations.find(l => l.imei === imei)
          if (mockL) setLocation(mockL)
        }
      } catch (e) {
        // Fallback
        const mockD = mockDevices.find(d => d.imei === imei)
        const mockL = mockLocations.find(l => l.imei === imei)
        if (mockD) setDevice(mockD)
        if (mockL) setLocation(mockL)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [accessToken, account, imei])

  if (loading) {
    return (
      <>
        <Topbar title="Device Detail" />
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div className="skeleton" style={{ height: 200, width: '100%', marginBottom: 20 }} />
          <div className="skeleton" style={{ height: 100, width: '100%' }} />
        </div>
      </>
    )
  }

  if (!device) {
    return (
      <>
        <Topbar title="Device Detail" />
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <h3>Device Not Found</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>IMEI: {imei}</p>
          <button className="btn btn-primary" onClick={() => router.push('/devices')}>Back to List</button>
        </div>
      </>
    )
  }

  const isOnline = location?.status === '1'
  const isMoving = isOnline && Number(location?.speed || 0) > 0

  return (
    <>
      <Topbar title={`Device: ${device.deviceName}`} subtitle={`IMEI: ${imei}`} />

      <div style={{ marginBottom: 20 }}>
        <Link href="/devices" style={{ color: 'var(--cyan)', fontSize: 13, textDecoration: 'none' }}>← Back to Device List</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>
        {/* Left Side: Map and Live Video link */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Location Map Viewport */}
          <div className="card" style={{ padding: 0, height: 400, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1000 }}>
              <span className={`badge badge-${isOnline ? (isMoving ? 'moving' : 'online') : 'offline'}`} style={{ boxShadow: 'var(--shadow-card)' }}>
                {isOnline ? (isMoving ? `▶ Moving (${location?.speed} km/h)` : '● Online') : '✕ Offline'}
              </span>
            </div>
            {location ? (
              <LiveMapComponent devices={[location]} selected={location} onSelect={() => {}} />
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: 'var(--text-muted)' }}>
                No GPS location data available
              </div>
            )}
          </div>

          {/* Quick Tools & Camera Access */}
          <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🎥 Camera Hardware Supported</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                This device supports live ADAS/DMS camera streaming.
              </p>
            </div>
            <Link
              href={`/media?imei=${imei}`}
              className="btn btn-primary"
              style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}
            >
              📡 View Live Stream
            </Link>
          </div>
        </div>

        {/* Right Side: Specifications and Driver */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Device details */}
          <div className="card">
            <div className="card-title">🚗 Hardware Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              {[
                { label: 'Device Model', value: device.vehicleModels || '—' },
                { label: 'Hardware Type', value: device.mcType || '—' },
                { label: 'Plate Number', value: device.vehicleNumber || '—' },
                { label: 'Group / Fleet', value: device.deviceGroup || '—' },
                { label: 'SIM ICCID', value: device.sim || '—', mono: true },
                { label: 'Expiration Date', value: device.expiration?.slice(0,19) || '—' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--bg-border)', paddingBottom: 8 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                  <span className={item.mono ? 'mono' : ''} style={{ fontWeight: 600 }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Telemetry */}
          {location && (
            <div className="card">
              <div className="card-title">📡 Live Telemetry</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
                {[
                  { label: 'ACC Status', value: location.accStatus === '1' ? '🔑 ON' : '🔑 OFF', color: location.accStatus === '1' ? 'var(--green)' : 'var(--text-muted)' },
                  { label: 'Current Speed', value: `${location.speed} km/h`, color: isMoving ? 'var(--cyan)' : 'inherit' },
                  { label: 'Battery Level', value: location.batteryPowerVal ? `${location.batteryPowerVal}%` : '—', color: Number(location.batteryPowerVal) < 20 ? 'var(--red)' : 'inherit' },
                  { label: 'GPS Satellites', value: location.gpsNum },
                  { label: 'Signal Strength', value: '▐'.repeat(Number(location.gpsSignal)) + '░'.repeat(4 - Number(location.gpsSignal)), color: 'var(--green)' },
                  { label: 'Last GPS Time', value: location.gpsTime || '—' },
                  { label: 'Accumulated Odo', value: `${Number(location.currentMileage).toFixed(1)} km` },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--bg-border)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    <span style={{ fontWeight: 600, color: item.color }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Driver info */}
          <div className="card">
            <div className="card-title">👤 Driver Information</div>
            {device.driverName ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Driver Name</span>
                  <span style={{ fontWeight: 600 }}>{device.driverName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Driver Phone</span>
                  <span className="mono" style={{ fontWeight: 600 }}>{device.driverPhone}</span>
                </div>
                <a
                  href={`tel:${device.driverPhone}`}
                  className="btn btn-secondary btn-sm w-full"
                  style={{ justifyContent: 'center', marginTop: 8 }}
                >
                  📞 Call Driver
                </a>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '10px 0', fontSize: 13 }}>
                No driver assigned to this vehicle
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
