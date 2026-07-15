'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'

function MediaPageContent() {
  const { accessToken } = useAuthStore()
  const searchParams = useSearchParams()
  const [imei, setImei] = useState('')
  const [channel, setChannel] = useState('1')
  const [streamUrl, setStreamUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'live' | 'events' | 'history'>('live')

  useEffect(() => {
    const queryImei = searchParams.get('imei')
    if (queryImei) setImei(queryImei)
  }, [searchParams])

  const mockEvents = [
    { type: 'Collision Alert (DVR)', imei: '862798051058689', time: '2026-07-14 14:59', lat: '22.576639', lng: '113.943077', thumb: null, isVideo: true },
    { type: 'Distraction Alert (DMS)', imei: '862798051058689', time: '2026-07-14 10:23', lat: '22.576551', lng: '113.943057', thumb: null, isVideo: true },
    { type: 'Fatigue Driving (ADAS)', imei: '862798051058689', time: '2026-07-13 21:10', lat: '22.576639', lng: '113.943077', thumb: null, isVideo: true },
  ]

  async function getLiveStream() {
    if (!accessToken || !imei) return
    setLoading(true)
    try {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, imei, channel, appId: Math.random().toString(36).slice(2, 17), action: 'livestream' }),
      })
      const json = await res.json()
      if (json.success) setStreamUrl(json.data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }

  return (
    <>
      <Topbar title="Media / Camera" subtitle="Live streaming, ADAS & DMS event recordings" />
      <div className="page-header">
        <h1 className="page-title">🎥 Media & Camera</h1>
        <p className="page-subtitle">Live streaming, ADAS collision alerts, DMS driver monitoring</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)', padding: 6, border: '1px solid var(--bg-border)', width: 'fit-content' }}>
        {(['live', 'events', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`btn btn-sm ${activeTab === tab ? 'btn-primary' : 'btn-ghost'}`}
            style={{ textTransform: 'capitalize' }}>
            {tab === 'live' ? '📡 Live Stream' : tab === 'events' ? '⚡ Event Recordings' : '🎞️ History'}
          </button>
        ))}
      </div>

      {activeTab === 'live' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          <div>
            {/* Stream viewport */}
            <div style={{ background: '#000', borderRadius: 'var(--r-lg)', border: '1px solid var(--bg-border)', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
              {streamUrl ? (
                <div style={{ color: 'var(--cyan)', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📡</div>
                  <div style={{ fontSize: 14 }}>Stream connected</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, wordBreak: 'break-all', padding: '0 24px' }}>{streamUrl}</div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: 64, marginBottom: 16 }}>📷</div>
                  <div>Enter IMEI and channel, then click Connect</div>
                </div>
              )}
              {/* Live indicator */}
              {streamUrl && <div style={{ position: 'absolute', top: 12, left: 12, background: 'var(--red)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 6, height: 6, background: '#fff', borderRadius: '50%', animation: 'pulse-dot 1s infinite' }} /> LIVE
              </div>}
            </div>

            {/* Controls */}
            <div className="card" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: '1 1 160px' }}>
                <label className="form-label">Device IMEI</label>
                <input className="form-input" placeholder="Enter IMEI" value={imei} onChange={e => setImei(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Channel</label>
                <select className="form-input" value={channel} onChange={e => setChannel(e.target.value)} style={{ width: 80 }}>
                  {[1,2,3,4].map(c => <option key={c} value={c}>CH {c}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={getLiveStream} disabled={loading || !imei}>
                {loading ? '⟳ Connecting...' : '📡 Connect Stream'}
              </button>
              {streamUrl && <button className="btn btn-danger" onClick={() => setStreamUrl('')}>⏹ Stop</button>}
            </div>
          </div>

          {/* Info panel */}
          <div className="card">
            <div className="card-title">ℹ️ Camera Info</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <p>Supported devices with camera capabilities:</p>
              <ul style={{ marginTop: 8, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <li><span style={{ color: 'var(--cyan)' }}>ADAS Camera</span> — Forward-facing, collision & lane departure detection</li>
                <li><span style={{ color: 'var(--purple)' }}>DMS Camera</span> — Driver-facing, fatigue & distraction detection</li>
                <li>Models: JC450Pro, JC451, JC371, JC181, JC182, JC261</li>
              </ul>
              <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', fontSize: 12 }}>
                <div style={{ color: 'var(--amber)', fontWeight: 600, marginBottom: 4 }}>⚠️ Protocol Note</div>
                <p>Concox devices (JC261, JC400): Channel starts from 0</p>
                <p>JT808 devices (JC371, JC450): Channel starts from 1</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {mockEvents.map((ev, i) => (
              <div key={i} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Thumbnail */}
                <div style={{ height: 160, background: 'linear-gradient(135deg, #0d1520, #1a2235)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <div style={{ fontSize: 48, opacity: 0.3 }}>🎥</div>
                  <div style={{ position: 'absolute', top: 8, left: 8 }}>
                    <span className="badge badge-alarm" style={{ fontSize: 10 }}>{ev.isVideo ? '▶ VIDEO' : '📷 PHOTO'}</span>
                  </div>
                  <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                    <button className="btn btn-primary btn-sm">▶ Play</button>
                  </div>
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6, color: 'var(--red)' }}>⚡ {ev.type}</div>
                  <div className="mono" style={{ fontSize: 11, marginBottom: 6 }}>{ev.imei}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🕐 {ev.time}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {ev.lat}, {ev.lng}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎞️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Historical Video</div>
          <div style={{ fontSize: 13 }}>Select a device and date to query historical recordings stored on the device SD card</div>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <input className="form-input" placeholder="IMEI" style={{ width: 200 }} />
            <input className="form-input" type="date" style={{ width: 160 }} />
            <select className="form-input" style={{ width: 100 }}>
              {[1,2,3,4].map(c => <option key={c} value={c}>CH {c}</option>)}
            </select>
            <button className="btn btn-primary">🔍 Query List</button>
          </div>
        </div>
      )}
    </>
  )
}

export default function MediaPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading...</div>}>
      <MediaPageContent />
    </Suspense>
  )
}
