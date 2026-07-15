'use client'
import dynamic from 'next/dynamic'
import { useEffect, useState, useCallback, useMemo } from 'react'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import type { DeviceLocation } from '@/lib/api/types'

// Leaflet must be loaded client-side only
const LiveMapComponent = dynamic(() => import('@/components/map/LiveMap'), { ssr: false, loading: () => (
  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-surface)', borderRadius: 'var(--r-lg)', minHeight: 500 }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
      <div style={{ color: 'var(--text-secondary)' }}>Loading map...</div>
    </div>
  </div>
)})

export default function MapPage() {
  const { accessToken, account, contextAccount } = useAuthStore()
  const [devices, setDevices] = useState<DeviceLocation[]>([])
  const [selected, setSelected] = useState<DeviceLocation | null>(null)
  
  // Filter states
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all')
  const [searchDevice, setSearchDevice] = useState('')
  const [searchAccount, setSearchAccount] = useState('')
  
  // Layout states
  const [accountTree, setAccountTree] = useState<any[]>([])
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({})
  const [selectedAccountName, setSelectedAccountName] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  
  // Sidebar states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isHoveringSidebar, setIsHoveringSidebar] = useState(false)

  // Auto-minimize sidebar after 3 seconds of no hover
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isSidebarOpen && !isHoveringSidebar) {
      timer = setTimeout(() => setIsSidebarOpen(false), 3000)
    }
    return () => clearTimeout(timer)
  }, [isSidebarOpen, isHoveringSidebar])

  const fetchLocations = useCallback(async () => {
    if (!accessToken || !account) return
    try {
      const res = await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, target: account, contextAccount }),
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setDevices(json.data)
        setLastUpdate(new Date())
      }
    } catch (e) {
      console.error('Failed to fetch locations:', e)
    }
  }, [accessToken, account, contextAccount])

  const fetchTree = useCallback(async () => {
    if (!accessToken || !account) return
    try {
      const res = await fetch(`/api/users/tree?accessToken=${encodeURIComponent(accessToken)}&target=${encodeURIComponent(account)}`)
      const json = await res.json()
      if (json.success) {
        // JIMI doesn't return the parent account itself in child.list, so we wrap it
        setAccountTree([{ account, name: account, children: json.data }])
        setExpandedAccounts(prev => ({ ...prev, [account]: true }))
      }
    } catch (e) {
      console.error(e)
    }
  }, [accessToken, account])

  useEffect(() => {
    fetchTree()
  }, [fetchTree])

  useEffect(() => {
    fetchLocations()
    const iv = setInterval(fetchLocations, 10000)
    return () => clearInterval(iv)
  }, [fetchLocations])

  // Group devices by account
  const groupedAccounts = useMemo(() => {
    const groups = devices.reduce((acc, loc: any) => {
      // Use the actual JIMI account injected by the API, fallback to local DB assignment, fallback to root account
      const gName = loc._jimiAccount || loc.assignedTo || account || 'Unassigned'
      if (!acc[gName]) acc[gName] = []
      acc[gName].push(loc)
      return acc
    }, {} as Record<string, DeviceLocation[]>)
    return groups
  }, [devices, account])

  // Auto-select first account if none selected
  useEffect(() => {
    if (!selectedAccountName && Object.keys(groupedAccounts).length > 0) {
      setSelectedAccountName(Object.keys(groupedAccounts)[0])
    }
  }, [groupedAccounts, selectedAccountName])

  // Helper to get all descendant account names for a given node
  const getDescendants = useCallback((nodes: any[], target: string): string[] | null => {
    for (const node of nodes) {
      if (node.account === target) {
        const collect = (n: any): string[] => {
          let res = [n.account]
          if (n.children) {
            n.children.forEach((c: any) => { res = res.concat(collect(c)) })
          }
          return res
        }
        return collect(node)
      }
      if (node.children) {
        const found = getDescendants(node.children, target)
        if (found) return found
      }
    }
    return null
  }, [])

  // Devices for the currently selected account (including all descendants)
  const activeAccountDevices = useMemo(() => {
    if (!selectedAccountName) return []
    const targets = getDescendants(accountTree, selectedAccountName) || [selectedAccountName]
    return devices.filter((d: any) => targets.includes(d._jimiAccount || d.assignedTo || account || 'Unassigned'))
  }, [selectedAccountName, accountTree, devices, getDescendants, account])
  
  const filteredDevices = activeAccountDevices.filter(d => {
    const matchStatus = filter === 'all' || (filter === 'online' ? d.status === '1' : d.status === '0')
    const matchSearch = !searchDevice || d.deviceName.toLowerCase().includes(searchDevice.toLowerCase()) || d.imei.includes(searchDevice)
    return matchStatus && matchSearch
  })

  // Build a map of account IDs to Names
  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>()
    map.set(account || '', account || '')
    const traverse = (nodes: any[]) => {
      for (const n of nodes) {
        map.set(n.account, n.name || n.account)
        if (n.children) traverse(n.children)
      }
    }
    traverse(accountTree)
    return map
  }, [accountTree, account])

  // Recursive Account Node Renderer
  const renderAccountNode = (node: any, level: number = 0) => {
    const accName = node.account
    const displayName = node.name || accName
    const locs = groupedAccounts[accName] || []
    const isSelected = selectedAccountName === accName
    const isExpanded = !!expandedAccounts[accName]
    const hasChildren = node.children && node.children.length > 0
    const onlineCount = locs.filter(d => d.status === '1').length

    // Filter by search
    if (searchAccount && !displayName.toLowerCase().includes(searchAccount.toLowerCase()) && !hasChildren) {
      return null // simple filter
    }

    return (
      <div key={accName}>
        <div 
          onClick={() => { setSelectedAccountName(accName); setSelected(null); setIsSidebarOpen(true) }}
          style={{
            padding: `8px 12px 8px ${12 + level * 16}px`, 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: isSelected ? 'rgba(0,212,255,0.08)' : 'transparent',
            color: isSelected ? 'var(--cyan)' : 'inherit',
            transition: 'background 0.2s'
          }}
        >
          {/* Caret for collapsing */}
          <div 
            onClick={(e) => {
              if (hasChildren) {
                e.stopPropagation()
                setExpandedAccounts(p => ({ ...p, [accName]: !p[accName] }))
              }
            }}
            style={{ width: 16, textAlign: 'center', opacity: hasChildren ? 1 : 0, color: 'var(--text-muted)' }}
          >
            {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
          </div>

          <span style={{ fontSize: 14 }}>👤</span>
          <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${displayName} (${accName})`}>
            <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500 }}>
              {displayName}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
              ({onlineCount}/{locs.length})
            </span>
          </div>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child: any) => renderAccountNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Topbar title="Live Map" subtitle={lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString('id-ID')}` : 'Loading...'} />

      <div style={{ display: 'flex', height: 'calc(100vh - var(--topbar-h) - 48px)', border: '1px solid var(--bg-border)', borderRadius: 'var(--r-lg)', overflow: 'hidden', position: 'relative' }}>
        
        {/* Toggle Button when minimized */}
        {!isSidebarOpen && (
          <button 
            onClick={() => { setIsSidebarOpen(true); setIsHoveringSidebar(true); }}
            style={{ 
              position: 'absolute', top: 16, left: 16, zIndex: 1000, 
              width: 40, height: 40, borderRadius: 'var(--r-md)', 
              background: 'var(--bg-elevated)', border: '1px solid var(--cyan)', 
              color: 'var(--cyan)', fontSize: 20, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            title="Open Sidebar"
          >
            ▶
          </button>
        )}

        {/* Sidebars Container */}
        <div 
          onMouseEnter={() => setIsHoveringSidebar(true)}
          onMouseLeave={() => setIsHoveringSidebar(false)}
          style={{ 
            display: 'flex', 
            width: isSidebarOpen ? 600 : 0, 
            opacity: isSidebarOpen ? 1 : 0,
            overflow: 'hidden',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s',
            borderRight: isSidebarOpen ? '1px solid var(--bg-border)' : 'none',
            flexShrink: 0
          }}
        >
          {/* Panel 1: Account List */}
          <div style={{ width: 260, background: 'var(--bg-surface)', borderRight: '1px solid var(--bg-border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '16px' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Account List</div>
              <input className="form-input" placeholder="Search customer name..." value={searchAccount} onChange={e => setSearchAccount(e.target.value)} style={{ height: 32, fontSize: 13 }} />
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 16px 0' }}>
              {accountTree.map(node => renderAccountNode(node, 0))}
            </div>
          </div>

          {/* Panel 2: Device List */}
          <div style={{ width: 340, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--bg-border)' }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {accountNameMap.get(selectedAccountName || '') || selectedAccountName || 'Select Account'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{activeAccountDevices.filter(d=>d.status==='1').length}/{activeAccountDevices.length}</span>
                  <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }} title="Minimize sidebar">◀</button>
                </div>
              </div>
              <input className="form-input" placeholder="Search device name or IMEI" value={searchDevice} onChange={e => setSearchDevice(e.target.value)} style={{ height: 32, fontSize: 13, marginBottom: 12 }} />
              
              <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
                <button onClick={() => setFilter('all')} style={{ fontWeight: filter === 'all' ? 700 : 400, color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>All {activeAccountDevices.length}</button>
                <button onClick={() => setFilter('online')} style={{ fontWeight: filter === 'online' ? 700 : 400, color: filter === 'online' ? 'var(--green)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Online {activeAccountDevices.filter(d=>d.status==='1').length}</button>
                <button onClick={() => setFilter('offline')} style={{ fontWeight: filter === 'offline' ? 700 : 400, color: filter === 'offline' ? 'var(--red)' : 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Offline {activeAccountDevices.filter(d=>d.status==='0').length}</button>
                <button onClick={fetchLocations} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cyan)' }}>↻</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {Object.entries(
                filteredDevices.reduce((acc, d: any) => {
                  const sup = d._jimiAccount || d.assignedTo || account || 'Unassigned'
                  if (!acc[sup]) acc[sup] = []
                  acc[sup].push(d)
                  return acc
                }, {} as Record<string, DeviceLocation[]>)
              ).map(([supAccount, locs]) => (
                <div key={supAccount} style={{ marginBottom: 16 }}>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', marginBottom: 12, fontSize: 12, fontWeight: 700, color: 'var(--cyan)' }}>
                    🏢 {accountNameMap.get(supAccount) || supAccount} ({locs.length})
                  </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {locs.map(d => {
                    const isOnline = d.status === '1'
                    const isMoving = isOnline && Number(d.speed) > 0
                    const iconColor = isOnline ? (isMoving ? 'var(--green)' : 'var(--cyan)') : 'var(--red)'
                    
                    return (
                      <div key={d.imei} onClick={() => setSelected(d)} style={{
                        padding: '12px', background: 'var(--bg-surface)',
                        border: `1px solid ${selected?.imei === d.imei ? 'var(--cyan)' : 'transparent'}`,
                        borderRadius: 'var(--r-md)', cursor: 'pointer', transition: 'var(--transition)',
                        display: 'flex', gap: 12, alignItems: 'flex-start'
                      }}>
                        {/* Vehicle Icon Circle */}
                        <div style={{ 
                          width: 40, height: 40, borderRadius: '50%', 
                          background: iconColor, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          boxShadow: `0 4px 12px ${iconColor}40`
                        }}>
                          <span style={{ fontSize: 20, color: '#fff' }}>🚗</span>
                        </div>

                        {/* Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: d.customColor || 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {d.deviceName}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                              {d.hbTime ? (d.hbTime.includes(' ') ? d.hbTime.split(' ')[1] : d.hbTime) : '—'}
                            </div>
                          </div>
                          
                          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{d.imei}</div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, borderTop: '1px solid var(--bg-border)', paddingTop: 8 }}>
                            <div style={{ fontSize: 11, color: iconColor, fontWeight: 600 }}>
                              {isOnline ? (isMoving ? `${d.speed} km/h` : 'Static') : 'Offline'}
                            </div>
                            <div style={{ display: 'flex', gap: 10, color: 'var(--text-secondary)', fontSize: 14 }}>
                              <span title="Details">📋</span>
                              <span title="Route">🛣️</span>
                              <span title="Command">⚙️</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            {filteredDevices.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                No devices found for this account
              </div>
            )}
          </div>
        </div>

        </div>
        
        {/* Map Area */}
        <div style={{ flex: 1, position: 'relative' }}>
          <LiveMapComponent devices={filteredDevices} selected={selected} onSelect={setSelected} />
        </div>

      </div>
    </>
  )
}
