'use client'
import { useEffect, useState, useCallback } from 'react'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import Link from 'next/link'

interface ParamPair {
  key: string
  value: string
}

interface EndpointDefinition {
  id: string
  category: string
  name: string
  method: string
  description: string
  params: ParamPair[]
}

// ─── API Features (Chapter 6 Tracksolid Pro v2.7.14 Spec) ────────────────────
const API_FEATURES_CATALOG: EndpointDefinition[] = [
  // 1. Access Token API
  {
    id: 'oauth_get',
    category: '1. Access Token API',
    name: '🔑 Get Access Token (jimi.oauth.token.get)',
    method: 'jimi.oauth.token.get',
    description: '7.5 Acquire access_token for API requests',
    params: [
      { key: 'user_id', value: 'tengon' },
      { key: 'user_pwd_md5', value: '8d20684c3e199af4fca3278206f214d1' },
      { key: 'expires_in', value: '7200' },
    ],
  },
  {
    id: 'oauth_refresh',
    category: '1. Access Token API',
    name: '🔄 Refresh Access Token (jimi.oauth.token.refresh)',
    method: 'jimi.oauth.token.refresh',
    description: '7.6 Refresh expired access_token using refresh_token',
    params: [
      { key: 'user_id', value: 'tengon' },
      { key: 'refresh_token', value: '' },
    ],
  },

  // 2. User & Account API
  {
    id: 'user_child_list',
    category: '2. User & Sub-Account API',
    name: '🏢 List All Sub-Accounts (jimi.user.child.list)',
    method: 'jimi.user.child.list',
    description: '7.7 Retrieve list of all sub-accounts under parent account',
    params: [
      { key: 'access_token', value: '' },
      { key: 'target', value: 'tengon' },
    ],
  },
  {
    id: 'user_child_create',
    category: '2. User & Sub-Account API',
    name: '➕ Create Sub-Account (jimi.user.child.create)',
    method: 'jimi.user.child.create',
    description: '7.8 Create a new sub-account',
    params: [
      { key: 'access_token', value: '' },
      { key: 'account', value: '' },
      { key: 'password', value: '' },
      { key: 'name', value: '' },
      { key: 'user_type', value: '1' },
    ],
  },
  {
    id: 'user_child_del',
    category: '2. User & Sub-Account API',
    name: '🗑️ Delete Sub-Account (jimi.user.child.del)',
    method: 'jimi.user.child.del',
    description: '7.9 Delete an existing sub-account',
    params: [
      { key: 'access_token', value: '' },
      { key: 'target', value: '' },
    ],
  },
  {
    id: 'user_device_list',
    category: '2. User & Sub-Account API',
    name: '📱 List All Devices of Account (jimi.user.device.list)',
    method: 'jimi.user.device.list',
    description: '7.11 Retrieve all devices assigned to an account',
    params: [
      { key: 'access_token', value: '' },
      { key: 'target', value: 'tengon' },
    ],
  },

  // 3. Device & Location API
  {
    id: 'user_device_loc_list',
    category: '3. Device & Location API',
    name: '📍 Get Device Locations List (jimi.user.device.location.list)',
    method: 'jimi.user.device.location.list',
    description: '7.13 Get real-time location data for all devices in an account',
    params: [
      { key: 'access_token', value: '' },
      { key: 'target', value: 'tengon' },
      { key: 'map_type', value: 'GOOGLE' },
    ],
  },
  {
    id: 'device_loc_get',
    category: '3. Device & Location API',
    name: '🎯 Get Device Location by IMEI (jimi.device.location.get)',
    method: 'jimi.device.location.get',
    description: '7.14 Retrieve real-time location for specific IMEI(s)',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imeis', value: '862292053704573' },
      { key: 'map_type', value: 'GOOGLE' },
    ],
  },
  {
    id: 'device_detail',
    category: '3. Device & Location API',
    name: 'ℹ️ Get Device Detail Info (jimi.track.device.detail)',
    method: 'jimi.track.device.detail',
    description: '7.12 Fetch complete details, status, and metadata for IMEI',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imei', value: '862292053704573' },
    ],
  },
  {
    id: 'device_share_url',
    category: '3. Device & Location API',
    name: '🔗 Get Location Share Map URL (jimi.device.location.URL.share)',
    method: 'jimi.device.location.URL.share',
    description: '7.15 Generate temporary public sharing map URL',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imei', value: '862292053704573' },
      { key: 'show_name', value: '1' },
      { key: 'show_icon', value: '1' },
      { key: 'show_trace', value: '1' },
    ],
  },
  {
    id: 'device_track_list',
    category: '3. Device & Location API',
    name: '🛣️ Get GPS Track Points Data (jimi.device.track.list)',
    method: 'jimi.device.track.list',
    description: '7.18 Query historical GPS track points for playback',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imeis', value: '862292053704573' },
      { key: 'begin_time', value: '2026-07-15 00:00:00' },
      { key: 'end_time', value: '2026-07-22 23:59:59' },
    ],
  },
  {
    id: 'device_update_info',
    category: '3. Device & Location API',
    name: '✏️ Update Vehicle Info by IMEI (jimi.open.device.update)',
    method: 'jimi.open.device.update',
    description: '7.19 Modify vehicle name, license plate, icon for device',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imei', value: '862292053704573' },
      { key: 'deviceName', value: '' },
    ],
  },

  // 4. Reports & Analytics API
  {
    id: 'report_mileage',
    category: '4. Reports & Analytics API',
    name: '📊 Get Mileage Data (jimi.device.track.mileage)',
    method: 'jimi.device.track.mileage',
    description: '7.17 Query daily/range total distance traveled',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imeis', value: '862292053704573' },
      { key: 'begin_time', value: '2026-07-15 00:00:00' },
      { key: 'end_time', value: '2026-07-22 23:59:59' },
    ],
  },
  {
    id: 'report_trips',
    category: '4. Reports & Analytics API',
    name: '🚗 Get Trips Report Data (jimi.device.trips.list)',
    method: 'jimi.device.trips.list',
    description: '7.51 Get start/end time, duration, and mileage of trips',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imeis', value: '862292053704573' },
      { key: 'begin_time', value: '2026-07-15 00:00:00' },
      { key: 'end_time', value: '2026-07-22 23:59:59' },
    ],
  },
  {
    id: 'report_parking',
    category: '4. Reports & Analytics API',
    name: '🅿️ Get Parking & Idling Data (jimi.device.parking.list)',
    method: 'jimi.device.parking.list',
    description: '7.40 Retrieve vehicle stop/idle locations and durations',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imeis', value: '862292053704573' },
      { key: 'begin_time', value: '2026-07-15 00:00:00' },
      { key: 'end_time', value: '2026-07-22 23:59:59' },
    ],
  },
  {
    id: 'report_obd',
    category: '4. Reports & Analytics API',
    name: '🔧 Get OBD Telemetry Data (jimi.device.obd.list)',
    method: 'jimi.device.obd.list',
    description: '7.53 Query vehicle ECU parameters (fuel, RPM, VIN)',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imeis', value: '862292053704573' },
      { key: 'begin_time', value: '2026-07-15 00:00:00' },
      { key: 'end_time', value: '2026-07-22 23:59:59' },
      { key: 'page_no', value: '1' },
    ],
  },
  {
    id: 'report_obd_fault',
    category: '4. Reports & Analytics API',
    name: '⚠️ Get OBD Fault Diagnostic Codes (jimi.device.obd.fault.list)',
    method: 'jimi.device.obd.fault.list',
    description: '7.54 Query engine DTC diagnostic fault codes',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imeis', value: '862292053704573' },
      { key: 'begin_time', value: '2026-07-15 00:00:00' },
      { key: 'end_time', value: '2026-07-22 23:59:59' },
    ],
  },

  // 5. Command & Control API
  {
    id: 'cmd_list',
    category: '5. Command & Control API',
    name: '📋 Get Supported Commands List (jimi.open.instruction.list)',
    method: 'jimi.open.instruction.list',
    description: '7.25 List commands supported by target device model',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imei', value: '862292053704573' },
    ],
  },
  {
    id: 'cmd_send',
    category: '5. Command & Control API',
    name: '📡 Send Command to Device (jimi.open.instruction.send)',
    method: 'jimi.open.instruction.send',
    description: '7.26 Issue remote cut-off, reboot, or configuration command',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imei', value: '862292053704573' },
      { key: 'inst_name', value: 'RELAY,1#' },
    ],
  },
  {
    id: 'cmd_result',
    category: '5. Command & Control API',
    name: '⏳ Get Command Result (jimi.open.instruction.result)',
    method: 'jimi.open.instruction.result',
    description: '7.27 Check execution status of sent instruction',
    params: [
      { key: 'access_token', value: '' },
      { key: 'command_id', value: '' },
    ],
  },
  {
    id: 'cmd_raw_send',
    category: '5. Command & Control API',
    name: '⚡ Send Raw Command (jimi.open.instruction.raw.send)',
    method: 'jimi.open.instruction.raw.send',
    description: '7.28 Send custom raw binary/text command packet',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imei', value: '862292053704573' },
      { key: 'content', value: '' },
    ],
  },

  // 6. Geo-fence API
  {
    id: 'fence_create',
    category: '6. Geo-fence API',
    name: '🛡️ Create Geo-fence for IMEI (jimi.open.device.fence.create)',
    method: 'jimi.open.device.fence.create',
    description: '7.23 Bind circular geofence boundary to device',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imei', value: '862292053704573' },
      { key: 'fenceName', value: 'Salatiga Area' },
      { key: 'lat', value: '-7.3473' },
      { key: 'lng', value: '110.5011' },
      { key: 'radius', value: '1000' },
      { key: 'alarmType', value: 'IN_OUT' },
    ],
  },
  {
    id: 'fence_delete',
    category: '6. Geo-fence API',
    name: '❌ Delete Device Geo-fence (jimi.open.device.fence.delete)',
    method: 'jimi.open.device.fence.delete',
    description: '7.24 Unbind or delete device geofence',
    params: [
      { key: 'access_token', value: '' },
      { key: 'fenceId', value: '' },
    ],
  },
  {
    id: 'fence_platform_list',
    category: '6. Geo-fence API',
    name: '🗺️ List Platform Geofences (jimi.platform.geofence.list)',
    method: 'jimi.platform.geofence.list',
    description: '7.45 List all platform polygon/circle fences for account',
    params: [
      { key: 'access_token', value: '' },
      { key: 'target', value: 'tengon' },
    ],
  },
  {
    id: 'fence_report_list',
    category: '6. Geo-fence API',
    name: '📥 Get Fence Entry & Exit Log (jimi.device.fence.report.list)',
    method: 'jimi.device.fence.report.list',
    description: '7.52 Query geofence trigger history logs',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imeis', value: '862292053704573' },
      { key: 'begin_time', value: '2026-07-15 00:00:00' },
      { key: 'end_time', value: '2026-07-22 23:59:59' },
    ],
  },

  // 7. Media & Camera API
  {
    id: 'media_photo_video',
    category: '7. Media & Camera API',
    name: '📷 Get Photo/Video Capture URL (jimi.device.media.URL)',
    method: 'jimi.device.media.URL',
    description: '7.20 Fetch snapshot image or recorded video clip URL',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imei', value: '864993060624336' },
      { key: 'mediaType', value: '1' },
    ],
  },
  {
    id: 'media_live_page',
    category: '7. Media & Camera API',
    name: '🎥 Get DVR Live Stream Web Page URL (jimi.device.live.page.url)',
    method: 'jimi.device.live.page.url',
    description: '7.21 Get embedded video player URL fordashcam',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imei', value: '864993060624336' },
      { key: 'channel', value: '1' },
    ],
  },
  {
    id: 'media_rtmp_url',
    category: '7. Media & Camera API',
    name: '🔴 Get Video RTMP Stream URL (jimi.device.video.rtmp.url)',
    method: 'jimi.device.video.rtmp.url',
    description: '7.37 Fetch raw RTMP video stream URL',
    params: [
      { key: 'access_token', value: '' },
      { key: 'imei', value: '864993060624336' },
      { key: 'channel', value: '1' },
    ],
  },

  // 8. Alarm & Push Message API
  {
    id: 'alarm_list',
    category: '8. Alarm & Push Message API',
    name: '🔔 Get Device Alarm List (jimi.device.alarm.list)',
    method: 'jimi.device.alarm.list',
    description: '7.32 Retrieve speeding, SOS, tamper, low battery alarms',
    params: [
      { key: 'access_token', value: '' },
      { key: 'begin_time', value: '2026-07-15 00:00:00' },
      { key: 'end_time', value: '2026-07-22 23:59:59' },
      { key: 'page_no', value: '1' },
      { key: 'page_size', value: '20' },
    ],
  },

  // 9. Custom Endpoint
  {
    id: 'custom',
    category: '9. Custom Endpoint',
    name: '⚙️ Custom Endpoint Method',
    method: '',
    description: 'Input any custom Jimi IoT method manually',
    params: [{ key: 'access_token', value: '' }],
  },
]

export default function ApiTestPage() {
  const { accessToken, account } = useAuthStore()

  const [selectedFeatureId, setSelectedFeatureId] = useState(API_FEATURES_CATALOG[0].id)
  const [method, setMethod] = useState(API_FEATURES_CATALOG[0].method)
  const [params, setParams] = useState<ParamPair[]>(API_FEATURES_CATALOG[0].params)
  const [activeDescription, setActiveDescription] = useState(API_FEATURES_CATALOG[0].description)
  
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  
  const [recentLogs, setRecentLogs] = useState<any[]>([])

  // Auto-fill access_token when available
  useEffect(() => {
    if (accessToken) {
      setParams(prev =>
        prev.map(p => (p.key === 'access_token' && !p.value ? { ...p, value: accessToken } : p))
      )
    }
  }, [accessToken])

  // Select Preset Feature Handler
  const handleSelectFeature = (id: string) => {
    setSelectedFeatureId(id)
    const feature = API_FEATURES_CATALOG.find(f => f.id === id) || API_FEATURES_CATALOG[0]
    setMethod(feature.method)
    setActiveDescription(feature.description)
    setParams(
      feature.params.map(p =>
        p.key === 'access_token' && accessToken ? { ...p, value: accessToken } : p
      )
    )
  }

  // Parameter Handlers
  const handleParamChange = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...params]
    updated[index][field] = val
    setParams(updated)
  }

  const addParam = () => setParams([...params, { key: '', value: '' }])
  const removeParam = (index: number) => setParams(params.filter((_, i) => i !== index))

  // Fetch recent API activity logs
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs?limit=15')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setRecentLogs(json.data)
      }
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Execute API Request
  const handleExecute = async () => {
    if (!method) {
      setError('Method API wajib diisi!')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)

    const paramObj: Record<string, string> = {}
    params.forEach(p => {
      if (p.key.trim()) paramObj[p.key.trim()] = p.value
    })

    try {
      const res = await fetch('/api/test-runner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          params: paramObj,
        }),
      })

      const json = await res.json()
      setResult(json)
      fetchLogs()
    } catch (err: any) {
      setError(err.message || 'Gagal mengeksekusi request')
    } finally {
      setLoading(false)
    }
  }

  // Group catalog by category for HTML optgroup
  const categoriesMap = API_FEATURES_CATALOG.reduce((acc, feat) => {
    if (!acc[feat.category]) acc[feat.category] = []
    acc[feat.category].push(feat)
    return acc
  }, {} as Record<string, EndpointDefinition[]>)

  return (
    <>
      <Topbar title="API Test Console" subtitle="Jimi IoT Tracksolid Pro v2.7.14 Open API Tester & Debugger" />

      <div style={{ maxWidth: 1400 }}>
        {/* Navigation Tabs under User Management */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <Link
            href="/users"
            className="btn btn-ghost btn-sm"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid var(--bg-border)',
              borderRadius: 'var(--r-md)',
            }}
          >
            👥 User Management
          </Link>
          <Link
            href="/users/api-test"
            className="btn btn-secondary btn-sm"
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 700,
              background: 'rgba(0,245,255,0.15)',
              color: 'var(--cyan)',
              border: '1px solid rgba(0,245,255,0.3)',
              borderRadius: 'var(--r-md)',
            }}
          >
            🧪 API Test Console (Bab 6 Features)
          </Link>
        </div>

        {/* Top Info Banner */}
        <div
          className="card"
          style={{
            padding: 16,
            marginBottom: 20,
            background: 'linear-gradient(135deg, rgba(0,245,255,0.04) 0%, rgba(10,10,20,0.7) 100%)',
            borderLeft: '4px solid var(--cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--cyan)', fontFamily: 'Orbitron, monospace' }}>
              ⚡ Tracksolid Pro Open API v2.7.14 — Chapter 6 API Features
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              Account: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{account || 'tengon'}</span> · Status Token:{' '}
              {accessToken ? <span style={{ color: 'var(--green)', fontWeight: 700 }}>● Active</span> : <span style={{ color: 'var(--red)', fontWeight: 700 }}>✕ Unauthenticated</span>}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            Base URL: https://hk-open.tracksolidpro.com/route/rest
          </div>
        </div>

        {/* Main Grid: Tester Form & Output Panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
          {/* Left Panel: Request Configuration */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15, borderBottom: '1px solid var(--bg-border)', paddingBottom: 10 }}>
              🚀 Request Configuration (Bab 6 API Features)
            </div>

            {/* Endpoint Preset Categorized Selection */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                Pilih Fitur API (Bab 6 Spec Catalog):
              </label>
              <select
                className="form-input"
                value={selectedFeatureId}
                onChange={e => handleSelectFeature(e.target.value)}
                style={{ width: '100%', fontSize: 13, background: 'var(--bg-elevated)', color: 'var(--cyan)', fontWeight: 600 }}
              >
                {Object.entries(categoriesMap).map(([category, items]) => (
                  <optgroup key={category} label={`━━ ${category} ━━`}>
                    {items.map(feat => (
                      <option key={feat.id} value={feat.id} style={{ color: 'var(--text-primary)' }}>
                        {feat.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              {activeDescription && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                  📖 Ref Spec: {activeDescription}
                </div>
              )}
            </div>

            {/* Method Input */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
                Method API Name:
              </label>
              <input
                className="form-input mono"
                placeholder="e.g. jimi.user.device.location.list"
                value={method}
                onChange={e => setMethod(e.target.value)}
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>

            {/* Key-Value Parameters Editor */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Parameters (Private Params):
                </label>
                <button onClick={addParam} className="btn btn-ghost btn-sm" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--cyan)' }}>
                  + Add Parameter
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
                {params.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      className="form-input mono"
                      placeholder="Param Key"
                      value={p.key}
                      onChange={e => handleParamChange(idx, 'key', e.target.value)}
                      style={{ flex: 1, height: 32, fontSize: 12 }}
                    />
                    <input
                      className="form-input mono"
                      placeholder="Value"
                      value={p.value}
                      onChange={e => handleParamChange(idx, 'value', e.target.value)}
                      style={{ flex: 1.5, height: 32, fontSize: 12 }}
                    />
                    <button
                      onClick={() => removeParam(idx)}
                      style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                      title="Hapus parameter"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Execute Button */}
            <button
              onClick={handleExecute}
              disabled={loading}
              className="btn btn-primary"
              style={{
                marginTop: 10,
                height: 42,
                fontSize: 14,
                fontWeight: 800,
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #00f5ff 0%, #0088ff 100%)',
              }}
            >
              {loading ? '⟳ Executing API Request...' : '🚀 Send API Request'}
            </button>

            {error && (
              <div style={{ padding: 12, borderRadius: 'var(--r-md)', background: 'rgba(255,0,64,0.1)', color: 'var(--red)', border: '1px solid rgba(255,0,64,0.3)', fontSize: 12 }}>
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Right Panel: Output & Signature Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Signature Calculation Breakdown Box */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>🔑 Signature (`sign`) Calculation Debugger</span>
                {result?.signatureDebug && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(0,255,65,0.1)', color: 'var(--green)', border: '1px solid rgba(0,255,65,0.25)' }}>
                    MD5 Generated
                  </span>
                )}
              </div>

              {result?.signatureDebug ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Generated MD5 Sign (32 Characters UPPERCASE):</div>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--cyan)', background: 'var(--bg-base)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(0,245,255,0.3)', marginTop: 4 }}>
                      {result.signatureDebug.generatedSign}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>UTC Timestamp Sent:</div>
                    <div className="mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {result.signatureDebug.timestamp}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Raw Pre-Hash String (appSecret + sorted params + appSecret):</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-base)', padding: 8, borderRadius: 6, border: '1px solid var(--bg-border)', wordBreak: 'break-all', maxHeight: 80, overflowY: 'auto' }}>
                      {result.signatureDebug.rawString}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Kirim request untuk melihat kalkulasi signature MD5 real-time.
                </div>
              )}
            </div>

            {/* 📤 JSON Request Body / Payload Box */}
            <div className="card">
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📤 JSON Request Body / Payload</span>
                {result?.requestPayload && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(0,245,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,245,255,0.25)', fontWeight: 600 }}>
                    Payload Data
                  </span>
                )}
              </div>

              {result?.requestPayload ? (
                <pre
                  className="mono"
                  style={{
                    fontSize: 11.5,
                    background: 'var(--bg-base)',
                    padding: 12,
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--bg-border)',
                    maxHeight: 180,
                    overflowY: 'auto',
                    color: 'var(--cyan)',
                  }}
                >
                  {JSON.stringify(result.requestPayload, null, 2)}
                </pre>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Kirim request untuk melihat objek JSON request body yang dikirim ke server Jimi IoT.
                </div>
              )}
            </div>

            {/* Response Output Box */}
            <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>📦 API Response Payload</span>
                {result && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: result.httpStatus === 200 ? 'rgba(0,255,65,0.1)' : 'rgba(255,0,64,0.1)', color: result.httpStatus === 200 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                      HTTP {result.httpStatus || 200}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {result.durationMs}ms
                    </span>
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minHeight: 200 }}>
                {result ? (
                  <pre
                    className="mono"
                    style={{
                      fontSize: 11.5,
                      background: 'var(--bg-base)',
                      padding: 14,
                      borderRadius: 'var(--r-md)',
                      border: '1px solid var(--bg-border)',
                      maxHeight: 320,
                      overflowY: 'auto',
                      color: '#a6accd',
                    }}
                  >
                    {JSON.stringify(result.response || result, null, 2)}
                  </pre>
                ) : (
                  <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                    Pilih preset fitur API di sebelah kiri dan klik <b>Send API Request</b> untuk menguji panggilan API.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Recent API Activity Logs */}
        <div className="card" style={{ marginTop: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📜 Recent API Activity Logs</span>
            <button onClick={fetchLogs} className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>↻ Refresh Logs</button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Method / Endpoint</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Code / Message</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                      No recent API logs recorded.
                    </td>
                  </tr>
                ) : (
                  recentLogs.slice(0, 10).map((log, idx) => (
                    <tr key={idx}>
                      <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{log.timestamp}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--cyan)', fontSize: 12, fontFamily: 'monospace' }}>
                          {log.endpoint}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: log.status === 200 ? 'rgba(0,255,65,0.1)' : 'rgba(255,0,64,0.1)', color: log.status === 200 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
                          {log.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, fontFamily: 'monospace' }}>{log.durationMs}ms</td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {log.response?.message ? `${log.response?.code}: ${log.response?.message}` : log.error || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
