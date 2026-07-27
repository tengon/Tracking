'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Topbar from '@/components/layout/Topbar'

interface LogEntry {
  timestamp: string
  method: 'GET' | 'POST' | 'PUSH' | 'PUT' | 'DELETE'
  endpoint: string
  status?: number
  durationMs?: number
  request: any
  response: any
  error?: string
}

interface AvailableFile {
  name: string
  date: string
  size: number
}

export default function ApiLogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [availableFiles, setAvailableFiles] = useState<AvailableFile[]>([])
  const [selectedFileDate, setSelectedFileDate] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true)
  const [search, setSearch] = useState<string>('')
  const [methodFilter, setMethodFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [inspectLog, setInspectLog] = useState<LogEntry | null>(null)
  const [copied, setCopied] = useState<boolean>(false)
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table')
  const [rawContent, setRawContent] = useState<string>('')

  // Fetch log list
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs?limit=200')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setLogs(json.data)
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch available log files
  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/logs?type=files')
      const json = await res.json()
      if (json.success && Array.isArray(json.files)) {
        setAvailableFiles(json.files)
        if (json.files.length > 0 && !selectedFileDate) {
          setSelectedFileDate(json.files[0].date)
        }
      }
    } catch (err) {
      console.error('Failed to fetch log files list:', err)
    }
  }, [selectedFileDate])

  // Fetch raw log content
  const fetchRawLog = useCallback(async (dateStr?: string) => {
    try {
      const param = dateStr ? `?type=raw&date=${dateStr}` : '?type=raw'
      const res = await fetch(`/api/logs${param}`)
      const text = await res.text()
      setRawContent(text)
    } catch (err) {
      setRawContent('Error loading raw log content.')
    }
  }, [])

  useEffect(() => {
    fetchLogs()
    fetchFiles()
  }, [fetchLogs, fetchFiles])

  // Auto refresh every 3 seconds
  useEffect(() => {
    if (!autoRefresh || viewMode === 'raw') return
    const interval = setInterval(() => {
      fetchLogs()
    }, 3000)
    return () => clearInterval(interval)
  }, [autoRefresh, viewMode, fetchLogs])

  useEffect(() => {
    if (viewMode === 'raw') {
      fetchRawLog(selectedFileDate)
    }
  }, [viewMode, selectedFileDate, fetchRawLog])

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Method Filter
      if (methodFilter !== 'ALL' && log.method !== methodFilter) return false

      // Status Filter
      if (statusFilter === '200' && log.status !== 200) return false
      if (statusFilter === 'ERR' && (!log.status || log.status === 200)) return false

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase()
        const endpointMatch = log.endpoint.toLowerCase().includes(q)
        const methodMatch = log.method.toLowerCase().includes(q)
        const errorMatch = log.error?.toLowerCase().includes(q) ?? false
        const reqStr = JSON.stringify(log.request || {}).toLowerCase()
        const resStr = JSON.stringify(log.response || {}).toLowerCase()
        const bodyMatch = reqStr.includes(q) || resStr.includes(q)
        return endpointMatch || methodMatch || errorMatch || bodyMatch
      }

      return true
    })
  }, [logs, methodFilter, statusFilter, search])

  // Stat computations
  const totalRequests = logs.length
  const avgDuration = totalRequests > 0
    ? Math.round(logs.reduce((acc, curr) => acc + (curr.durationMs || 0), 0) / totalRequests)
    : 0
  const successCount = logs.filter(l => l.status === 200).length
  const successRate = totalRequests > 0 ? Math.round((successCount / totalRequests) * 100) : 100

  const handleCopyJson = (data: any) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <main className="main-content" style={{ minHeight: '100vh', paddingBottom: 40 }}>
      <Topbar title="API Activity Logs" />

      <div style={{ padding: '20px 28px' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              📜 System API Logs
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
              Real-time audit log of external Jimi API requests and internal service calls.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="btn-group" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 3 }}>
              <button
                className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('table')}
                style={{ fontSize: 12 }}
              >
                📊 Structured Feed
              </button>
              <button
                className={`btn btn-sm ${viewMode === 'raw' ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setViewMode('raw')}
                style={{ fontSize: 12 }}
              >
                📝 Raw File Viewer
              </button>
            </div>

            <button
              className={`btn btn-sm ${autoRefresh ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setAutoRefresh(!autoRefresh)}
              style={{ fontSize: 12 }}
            >
              {autoRefresh ? '🔄 Auto-Refresh: ON' : '⏸️ Auto-Refresh: OFF'}
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          <div className="card" style={{ padding: '16px 20px', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>TOTAL LOGGED REQUESTS</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--cyan)' }}>{totalRequests}</div>
          </div>

          <div className="card" style={{ padding: '16px 20px', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>AVG RESPONSE TIME</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: avgDuration > 500 ? '#f59e0b' : '#10b981' }}>
              {avgDuration} <span style={{ fontSize: 14, fontWeight: 500 }}>ms</span>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>SUCCESS RATE</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: successRate >= 95 ? '#10b981' : '#ef4444' }}>
              {successRate}%
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>DAILY LOG FILES</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
              {availableFiles.length} File{availableFiles.length !== 1 ? 's' : ''} Recorded
            </div>
          </div>
        </div>

        {/* View Mode: Structured Feed Table */}
        {viewMode === 'table' && (
          <>
            {/* Filter Bar */}
            <div className="card" style={{ padding: '14px 20px', marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', flex: 1 }}>
                <input
                  type="text"
                  placeholder="🔍 Search endpoint, params, or error..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'var(--text-primary)',
                    minWidth: 260,
                    fontSize: 13,
                  }}
                />

                <select
                  value={methodFilter}
                  onChange={e => setMethodFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                >
                  <option value="ALL">All Methods</option>
                  <option value="POST">POST</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="200">200 OK Only</option>
                  <option value="ERR">Errors Only</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={fetchLogs}
                  style={{ fontSize: 12 }}
                >
                  🔄 Refresh Feed
                </button>
              </div>
            </div>

            {/* Log Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 12 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Timestamp</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Method</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Endpoint / Method</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Duration</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600 }}>Details / Error</th>
                      <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'center' }}>Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
                          Loading logs...
                        </td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: 'var(--text-secondary)' }}>
                          No API logs match the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map((entry, idx) => {
                        const isErr = entry.status !== 200 || !!entry.error
                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              background: isErr ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                              transition: 'background 0.2s ease',
                            }}
                          >
                            <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                              {entry.timestamp}
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  fontFamily: 'monospace',
                                  background: entry.method === 'POST' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                  color: entry.method === 'POST' ? '#60a5fa' : '#34d399',
                                  border: `1px solid ${entry.method === 'POST' ? 'rgba(96, 165, 250, 0.3)' : 'rgba(52, 211, 153, 0.3)'}`,
                                }}
                              >
                                {entry.method}
                              </span>
                            </td>
                            <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--cyan)' }}>
                              {entry.endpoint}
                            </td>
                            <td style={{ padding: '10px 16px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 10,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: isErr ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                  color: isErr ? '#f87171' : '#34d399',
                                }}
                              >
                                {entry.status ?? 200}
                              </span>
                            </td>
                            <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                              {entry.durationMs ?? 0} ms
                            </td>
                            <td style={{ padding: '10px 16px', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {entry.error ? (
                                <span style={{ color: '#f87171', fontWeight: 500 }}>⚠️ {entry.error}</span>
                              ) : (
                                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                                  {JSON.stringify(entry.response).slice(0, 60)}...
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setInspectLog(entry)}
                                style={{ padding: '4px 10px', fontSize: 12 }}
                              >
                                👁️ View
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* View Mode: Raw Log Viewer */}
        {viewMode === 'raw' && (
          <div className="card" style={{ padding: 20, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Select Log File:</span>
                <select
                  value={selectedFileDate}
                  onChange={e => setSelectedFileDate(e.target.value)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.3)',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                  }}
                >
                  {availableFiles.map(file => (
                    <option key={file.name} value={file.date}>
                      {file.name} ({formatBytes(file.size)})
                    </option>
                  ))}
                </select>
              </div>

              <a
                href={`/api/logs?type=raw&date=${selectedFileDate}`}
                target="_blank"
                download={`api-${selectedFileDate}.log`}
                className="btn btn-primary btn-sm"
                style={{ fontSize: 12, textDecoration: 'none' }}
              >
                📥 Download Log File
              </a>
            </div>

            <pre
              style={{
                background: '#0d1117',
                padding: 16,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.1)',
                fontFamily: 'monospace',
                fontSize: 12,
                maxHeight: 600,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: '#e6edf3',
                lineHeight: 1.5,
              }}
            >
              {rawContent}
            </pre>
          </div>
        )}

        {/* Inspect Modal */}
        {inspectLog && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999,
              padding: 20,
            }}
            onClick={() => setInspectLog(null)}
          >
            <div
              style={{
                background: 'var(--card-bg, #161b22)',
                border: '1px solid var(--border, #30363d)',
                borderRadius: 16,
                width: '100%',
                maxWidth: 800,
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 11,
                      fontWeight: 700,
                      marginRight: 10,
                      background: inspectLog.method === 'POST' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: inspectLog.method === 'POST' ? '#60a5fa' : '#34d399',
                    }}
                  >
                    {inspectLog.method}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--cyan)' }}>{inspectLog.endpoint}</span>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setInspectLog(null)}
                  style={{ fontSize: 18, padding: '4px 8px' }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Meta details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: 'rgba(0,0,0,0.2)', padding: 12, borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Timestamp</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 600 }}>{inspectLog.timestamp}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Status Code</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: inspectLog.status === 200 ? '#34d399' : '#f87171' }}>
                      {inspectLog.status ?? 200}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Duration</div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace' }}>{inspectLog.durationMs ?? 0} ms</div>
                  </div>
                </div>

                {inspectLog.error && (
                  <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', fontSize: 13 }}>
                    ⚠️ <strong>Error:</strong> {inspectLog.error}
                  </div>
                )}

                {/* Request Payload */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>REQUEST PAYLOAD</div>
                  <pre
                    style={{
                      background: '#0d1117',
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#e6edf3',
                      overflowX: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {JSON.stringify(inspectLog.request, null, 2)}
                  </pre>
                </div>

                {/* Response Payload */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: 'var(--text-secondary)' }}>RESPONSE BODY</div>
                  <pre
                    style={{
                      background: '#0d1117',
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.08)',
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: '#e6edf3',
                      overflowX: 'auto',
                      maxHeight: 260,
                    }}
                  >
                    {JSON.stringify(inspectLog.response, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleCopyJson(inspectLog)}
                >
                  {copied ? '✅ Copied!' : '📋 Copy Log Entry JSON'}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setInspectLog(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
