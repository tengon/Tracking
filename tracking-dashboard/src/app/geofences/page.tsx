'use client'
import dynamic from 'next/dynamic'
import { useState, useCallback, useEffect } from 'react'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import type { Geofence } from '@/lib/api/types'

const GeofenceMap = dynamic(() => import('@/components/map/GeofenceMap'), {
  ssr: false, loading: () => (
    <div style={{ flex: 1, background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <span style={{ color: 'var(--text-muted)' }}>🗺️ Loading map...</span>
    </div>
  )
})

import { mockGeofences } from '@/lib/api/mockData'

export default function GeofencesPage() {
  const { accessToken, account } = useAuthStore()
  const [geofences, setGeofences] = useState<Geofence[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Geofence | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [newFence, setNewFence] = useState({ name: '', type: 'circle', coordinates: '', radius: '500', alertType: 'both' })
  const [isDemo, setIsDemo] = useState(false)

  const loadFences = useCallback(async () => {
    if (!accessToken || !account) return
    setLoading(true)
    try {
      const res = await fetch('/api/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, account }),
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data?.rows) && json.data.rows.length > 0) {
        setGeofences(json.data.rows)
        setIsDemo(false)
      } else {
        setGeofences(mockGeofences)
        setIsDemo(true)
      }
    } catch {
      setGeofences(mockGeofences)
      setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }, [accessToken, account])

  useEffect(() => {
    loadFences()
  }, [loadFences])

  async function saveFence() {
    if (!accessToken || !account || !newFence.name || !newFence.coordinates) return
    setLoading(true)
    try {
      const res = await fetch('/api/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          action: 'create',
          fenceData: {
            fence_name: newFence.name,
            fence_type: newFence.type,
            coordinates: newFence.coordinates,
            radius: newFence.type === 'circle' ? newFence.radius : undefined,
            alert_type: newFence.alertType,
          }
        }),
      })
      const json = await res.json()
      if (json.success) {
        setShowCreate(false)
        setNewFence({ name: '', type: 'circle', coordinates: '', radius: '500', alertType: 'both' })
        loadFences()
      } else {
        alert(json.error || 'Failed to save geofence')
      }
    } catch (e: any) {
      alert(e.message || 'Error occurred while saving')
    } finally {
      setLoading(false)
    }
  }

  async function deleteFence(id: string) {
    if (!accessToken || !confirm('Delete this geofence?')) return
    await fetch('/api/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken, action: 'delete', fenceId: id }),
    })
    setGeofences(prev => prev.filter(f => f.fence_id !== id))
  }

  return (
    <>
      <Topbar title="Geofences" subtitle="Virtual boundaries and zone alerts" />
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 className="page-title" style={{ margin: 0 }}>🗺️ Geofence Manager</h1>
          {isDemo && (
            <span className="badge badge-alarm" style={{ background: 'rgba(251,191,36,0.1)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.3)', padding: '4px 10px' }}>
              ⚠️ Demo Mode
            </span>
          )}
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={loadFences}>↻ Load Fences</button>
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>+ Create Fence</button>
        </div>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">➕ Create New Geofence</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-input" placeholder="e.g. Warehouse A" value={newFence.name} onChange={e => setNewFence(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-input" value={newFence.type} onChange={e => setNewFence(p => ({ ...p, type: e.target.value }))}>
                <option value="circle">⭕ Circle</option>
                <option value="polygon">🔷 Polygon</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Center (lat,lng)</label>
              <input className="form-input" placeholder="-6.200,106.816" value={newFence.coordinates} onChange={e => setNewFence(p => ({ ...p, coordinates: e.target.value }))} />
            </div>
            {newFence.type === 'circle' && (
              <div className="form-group">
                <label className="form-label">Radius (meters)</label>
                <input className="form-input" type="number" value={newFence.radius} onChange={e => setNewFence(p => ({ ...p, radius: e.target.value }))} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Alert On</label>
              <select className="form-input" value={newFence.alertType} onChange={e => setNewFence(p => ({ ...p, alertType: e.target.value }))}>
                <option value="in">Enter Zone</option>
                <option value="out">Exit Zone</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={saveFence}>✅ Save Geofence</button>
            <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        {/* Map */}
        <div style={{ borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--bg-border)', height: 'calc(100vh - 220px)', minHeight: 800 }}>
          <GeofenceMap geofences={geofences} selected={selected} onSelect={setSelected} />
        </div>

        {/* List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: 'calc(100vh - 220px)', minHeight: 700, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--bg-border)', fontWeight: 700 }}>
            📋 Geofences ({geofences.length})
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {geofences.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                Click "Load Fences" to fetch geofences
              </div>
            ) : geofences.map(f => (
              <div key={f.fence_id} onClick={() => setSelected(f)} style={{
                padding: '12px 16px', borderBottom: '1px solid var(--bg-border)', cursor: 'pointer',
                background: selected?.fence_id === f.fence_id ? 'rgba(0,212,255,0.08)' : 'transparent',
                transition: 'var(--transition)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{f.fence_name}</span>
                  <span style={{ fontSize: 10, background: `${f.fence_color}20`, color: f.fence_color, padding: '2px 8px', borderRadius: 'var(--r-full)', border: `1px solid ${f.fence_color}40` }}>
                    {f.fence_type}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Alert: {f.alert_type} · {f.radius ? `r=${f.radius}m` : 'polygon'} · {f.imeis?.split(',').length || 0} devices
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" style={{ fontSize: 10 }}>Bind Device</button>
                  <button className="btn btn-danger btn-sm" style={{ fontSize: 10 }} onClick={e => { e.stopPropagation(); deleteFence(f.fence_id) }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
