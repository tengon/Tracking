'use client'
import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import type { MileageTrip, TrackPoint } from '@/lib/api/types'
import Flatpickr from 'react-flatpickr'
import 'flatpickr/dist/themes/dark.css'

const TrackMap = dynamic(() => import('@/components/map/TrackMap'), {
  ssr: false, loading: () => (
    <div style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <span style={{ color: 'var(--text-muted)' }}>🗺️ Loading map...</span>
    </div>
  )
})



function formatDuration(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function TripsPage() {
  const { accessToken } = useAuthStore()
  const [imei, setImei] = useState('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 16)
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 16))
  const [trips, setTrips] = useState<MileageTrip[]>([])
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([])
  const [selectedTrip, setSelectedTrip] = useState<MileageTrip | null>(null)
  const [loading, setLoading] = useState(false)
  const [totalMileage, setTotalMileage] = useState(0)


  const toUtc = (local: string) => {
    const d = new Date(local); d.setHours(d.getHours() - 7)
    return d.toISOString().replace('T', ' ').slice(0, 19)
  }

  const search = useCallback(async () => {
    if (!imei || !accessToken) return
    setLoading(true)
    try {
      const [mileageRes, trackRes] = await Promise.all([
        fetch('/api/tracks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, imei, beginTime: toUtc(dateFrom), endTime: toUtc(dateTo), action: 'mileage' })
        }),
        fetch('/api/tracks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, imei, beginTime: toUtc(dateFrom), endTime: toUtc(dateTo) })
        }),
      ])
      const [mJson, tJson] = await Promise.all([mileageRes.json(), trackRes.json()])

      let gotTrips = false
      let gotPoints = false

      if (mJson.success && Array.isArray(mJson.data?.result) && mJson.data.result.length > 0) {
        setTrips(mJson.data.result)
        setTotalMileage((mJson.data.data?.[0]?.totalMileage || 0) / 1000)
        gotTrips = true
      }

      if (tJson.success && Array.isArray(tJson.data?.result) && tJson.data.result.length > 0) {
        setTrackPoints(tJson.data.result)
        gotPoints = true
      }

      if (!gotTrips) {
        setTrips([])
        setTotalMileage(0)
      }
      if (!gotPoints) {
        setTrackPoints([])
      }
    } catch (e) {
      console.error('Failed to fetch trip data:', e)
      setTrips([])
      setTrackPoints([])
      setTotalMileage(0)
    } finally {
      setLoading(false)
    }
  }, [imei, accessToken, dateFrom, dateTo])

  return (
    <>
      <Topbar title="Trip History & Playback" subtitle="View historical routes and mileage" />


      {/* Search Bar */}
      < div className="card" style={{ marginBottom: 20, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label className="form-label">Device IMEI</label>
          <input id="trip-imei" className="form-input" placeholder="Enter device IMEI" value={imei} onChange={e => setImei(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label className="form-label">Date From</label>
          <Flatpickr 
            className="form-input" 
            options={{ enableTime: true, dateFormat: "Y-m-d\\TH:i", time_24hr: true }}
            value={dateFrom} 
            onChange={([date]) => {
              if(date) {
                const tzOffset = date.getTimezoneOffset() * 60000;
                const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
                setDateFrom(localISOTime)
              }
            }} 
          />
        </div>
        <div className="form-group" style={{ flex: '1 1 200px' }}>
          <label className="form-label">Date To</label>
          <Flatpickr 
            className="form-input" 
            options={{ enableTime: true, dateFormat: "Y-m-d\\TH:i", time_24hr: true }}
            value={dateTo} 
            onChange={([date]) => {
              if(date) {
                const tzOffset = date.getTimezoneOffset() * 60000;
                const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
                setDateTo(localISOTime)
              }
            }} 
          />
        </div>
        <button className="btn btn-primary" onClick={search} disabled={loading || !imei}>
          {loading ? '⟳ Searching...' : '🔍 Search'}
        </button>
      </div >

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* Map */}
        <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--bg-border)', height: 'calc(100vh - 220px)', minHeight: 700 }}>
          <TrackMap points={trackPoints} trips={trips} selectedTrip={selectedTrip} />
        </div>

        {/* Trip List */}
        <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--bg-border)' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>📋 Trips ({trips.length})</div>
            {totalMileage > 0 && <div style={{ fontSize: 12, color: 'var(--cyan)', marginTop: 4 }}>Total: {totalMileage.toFixed(1)} km</div>}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {trips.length === 0 && !loading && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                Enter IMEI and date range to search trips
              </div>
            )}
            {trips.map((trip, i) => (
              <div key={i} onClick={() => setSelectedTrip(trip)} style={{
                padding: '12px 14px', background: selectedTrip === trip ? 'rgba(0,212,255,0.08)' : 'var(--bg-elevated)',
                border: `1px solid ${selectedTrip === trip ? 'rgba(0,212,255,0.3)' : 'var(--bg-border)'}`,
                borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'var(--transition)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>Trip #{i + 1}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan)' }}>
                    {(trip.distance / 1000).toFixed(1)} km
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  🕐 {trip.startTime?.slice(11, 16)} → {trip.endTime?.slice(11, 16)}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11 }}>
                  <span style={{ color: 'var(--text-muted)' }}>⏱ {formatDuration(trip.elapsed)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>⚡ avg {trip.avgSpeed} km/h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
