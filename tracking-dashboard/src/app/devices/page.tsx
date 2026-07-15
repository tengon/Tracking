'use client'
import { useEffect, useState, useCallback } from 'react'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import type { Device } from '@/lib/api/types'
import type { SubAccount } from '@/lib/api/tracksolid'
import Link from 'next/link'

import { mockDevices } from '@/lib/api/mockData'

export default function DevicesPage() {
  const { accessToken, account, contextAccount } = useAuthStore()
  const [devices, setDevices] = useState<any[]>([])
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isDemo, setIsDemo] = useState(false)

  // Assignment Modal State
  const [assignModal, setAssignModal] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const fetchDevices = useCallback(async () => {
    if (!accessToken || !account) return
    setLoading(true)
    
    const targetAccount = contextAccount || account;
    
    try {
      const res = await fetch('/api/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, target: account }), // always fetch from parent
      })
      const json = await res.json()
      let fetchedDevices = []
      
      if (json.success && Array.isArray(json.data)) {
        fetchedDevices = json.data.length === 0 ? mockDevices : json.data
        setIsDemo(json.data.length === 0)
      } else {
        fetchedDevices = mockDevices
        setIsDemo(true)
      }

      // Fetch local DB labels
      const labelsRes = await fetch('/api/db/labels')
      const labelsJson = await labelsRes.json()
      if (labelsJson.success) {
        const labelMap = new Map<string, any>()
        labelsJson.data.forEach((r: any) => labelMap.set(r.imei, r))
        
        fetchedDevices = fetchedDevices.map(d => {
          const custom = labelMap.get(d.imei)
          if (custom) {
            return {
              ...d,
              customName: custom.custom_name,
              assignedTo: custom.assigned_to_account,
              customColor: custom.color_override
            }
          }
          return d
        })
      }
      
      // Filter by context if a specific sub-account is selected
      if (contextAccount && contextAccount !== account) {
        fetchedDevices = fetchedDevices.filter(d => d.assignedTo === contextAccount)
      }
      
      setDevices(fetchedDevices)
      
    } catch {
      setDevices(mockDevices)
      setIsDemo(true)
    } finally {
      setLoading(false)
    }
  }, [accessToken, account, contextAccount])

  const fetchSubAccounts = useCallback(async () => {
    if (!accessToken || !account) return
    try {
      const res = await fetch(`/api/users?accessToken=${encodeURIComponent(accessToken)}&target=${encodeURIComponent(account)}`)
      const json = await res.json()
      if (json.success) setSubAccounts(json.data)
    } catch (e) {
      console.error(e)
    }
  }, [accessToken, account])

  useEffect(() => {
    fetchDevices()
    fetchSubAccounts()
  }, [fetchDevices, fetchSubAccounts])

  const handleSaveAssign = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await fetch('/api/db/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignModal)
      })
      setAssignModal(null)
      fetchDevices()
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const filtered = devices.filter(d =>
    !search || 
    d.deviceName.toLowerCase().includes(search.toLowerCase()) ||
    (d.customName && d.customName.toLowerCase().includes(search.toLowerCase())) ||
    d.imei.includes(search) || 
    (d.assignedTo && d.assignedTo.toLowerCase().includes(search.toLowerCase())) ||
    (d.vehicleNumber || '').toLowerCase().includes(search.toLowerCase())
  )

  const iconMap: Record<string, string> = {
    automobile: '🚗', bus: '🚌', truck: '🚛', motorcycle: '🏍️',
    taxi: '🚕', per: '🚶', plane: '✈️', ship: '🚢', other: '📦'
  }

  return (
    <>
      <Topbar title="Devices" subtitle={`${devices.length} total devices`} />
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title" style={{ margin: 0 }}>🚗 Device Management</h1>
            {isDemo && (
              <span className="badge badge-alarm" style={{ background: 'rgba(251,191,36,0.1)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.3)', padding: '4px 10px' }}>
                ⚠️ Demo Mode
              </span>
            )}
          </div>
          <p className="page-subtitle" style={{ marginTop: 4 }}>Kelola dan tetapkan perangkat GPS ke Sub-Account (Local DB)</p>
        </div>
        <div className="page-actions">
          <input className="form-input" style={{ width: 280 }} placeholder="🔍 Cari device, IMEI, assigned..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total', value: devices.length, color: 'var(--cyan)' },
          { label: 'Assigned', value: devices.filter(d => d.assignedTo).length, color: 'var(--purple)' },
          { label: 'Enabled', value: devices.filter(d => d.enabledFlag === 1).length, color: 'var(--green)' },
          { label: 'Expiring Soon', value: devices.filter(d => { const d30 = new Date(); d30.setDate(d30.getDate()+30); return new Date(d.expiration) < d30 }).length, color: 'var(--amber)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: 16, borderTop: `2px solid ${s.color}` }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Device</th><th>Assignment</th><th>Vehicle</th>
              <th>Group</th><th>SIM</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i}>{[...Array(7)].map((_, j) => (
                  <td key={j}><div className="skeleton" style={{ height: 14, width: '80%' }} /></td>
                ))}</tr>
              ))
            ) : filtered.map(d => {
              return (
                <tr key={d.imei}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: d.customColor ? `${d.customColor}20` : 'rgba(0,245,255,0.1)',
                        border: `1px solid ${d.customColor || 'rgba(0,245,255,0.3)'}`,
                        fontSize: 18
                      }}>
                        {iconMap[d.vehicleIcon] || '📦'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: d.customColor || 'var(--text-primary)' }}>
                          {d.customName || d.deviceName}
                        </div>
                        <div className="mono">{d.imei}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {d.assignedTo ? (
                      <span style={{ fontSize: 10, color: 'var(--cyan)', background: 'rgba(0,245,255,0.08)', padding: '4px 8px', borderRadius: 6, fontWeight: 700, border: '1px solid rgba(0,245,255,0.2)' }}>
                        👤 {d.assignedTo}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{d.vehicleName || d.vehicleNumber || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{d.vehicleModels || d.mcType}</div>
                  </td>
                  <td style={{ fontSize: 12 }}>{d.deviceGroup || '—'}</td>
                  <td className="mono">{d.sim || '—'}</td>
                  <td>
                    <span className={`badge ${d.enabledFlag === 1 ? 'badge-online' : 'badge-offline'}`}>
                      {d.enabledFlag === 1 ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => setAssignModal({
                        imei: d.imei,
                        custom_name: d.customName || d.deviceName,
                        assigned_to_account: d.assignedTo || '',
                        color_override: d.customColor || '#00F5FF'
                      })}>⚙️ Assign</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>No devices found</div>
        )}
      </div>

      {/* Assignment Modal */}
      {assignModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid rgba(0,245,255,0.18)', borderRadius: 'var(--r-xl)',
            padding: 32, width: '100%', maxWidth: 450,
            boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,245,255,0.05)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Orbitron, monospace' }}>⚙️ Set Device Label</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--cyan)', marginTop: 4 }}>IMEI: {assignModal.imei}</div>
              </div>
            </div>

            <form onSubmit={handleSaveAssign} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Custom Device Name</label>
                <input className="form-input" value={assignModal.custom_name} onChange={e => setAssignModal({ ...assignModal, custom_name: e.target.value })} required />
              </div>
              
              <div className="form-group">
                <label className="form-label">Assign To (Sub-Account)</label>
                <select className="form-input" value={assignModal.assigned_to_account} onChange={e => setAssignModal({ ...assignModal, assigned_to_account: e.target.value })}>
                  <option value="">[ Unassigned ]</option>
                  {subAccounts.map(sa => <option key={sa.account} value={sa.account}>{sa.name} ({sa.account})</option>)}
                </select>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Device akan tampil di dashboard sub-account yang dipilih.</div>
              </div>

              <div className="form-group">
                <label className="form-label">Custom Marker Color (Hex)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="color" value={assignModal.color_override} onChange={e => setAssignModal({ ...assignModal, color_override: e.target.value })} style={{ width: 40, height: 40, padding: 0, border: 'none', background: 'transparent' }} />
                  <input className="form-input" value={assignModal.color_override} onChange={e => setAssignModal({ ...assignModal, color_override: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setAssignModal(null)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? '⏳ Menyimpan...' : '✅ Simpan Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

