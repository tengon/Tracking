'use client'
import { useEffect, useState, useCallback } from 'react'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import { useThemeStore } from '@/lib/store/themeStore'
import type { SubAccount } from '@/lib/api/tracksolid'
import Link from 'next/link'

// ─── Modal ────────────────────────────────────────────────────────────────────
type ModalMode = 'create' | 'edit' | null

interface FormState {
  account:     string
  name:        string
  password:    string
  email:       string
  phone:       string
  companyName: string
}

const emptyForm: FormState = {
  account: '', name: '', password: '', email: '', phone: '', companyName: '',
}

export default function UsersPage() {
  const { accessToken, account: myAccount } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const [users,    setUsers]    = useState<SubAccount[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  const [modal,    setModal]    = useState<ModalMode>(null)
  const [form,     setForm]     = useState<FormState>(emptyForm)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  // ── MQTT Streaming State ───────────────────────────────────────────────────
  const [mqttSending, setMqttSending] = useState<string | null>(null)
  const [mqttResult, setMqttResult]   = useState<any | null>(null)
  const [copyingJson, setCopyingJson] = useState(false)
  const [mqttConnected, setMqttConnected] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    if (!accessToken || !myAccount) return
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/users?accessToken=${encodeURIComponent(accessToken)}&target=${encodeURIComponent(myAccount)}`)
      const json = await res.json()
      if (json.success) setUsers(json.data || [])
      else setError(json.error || 'Gagal memuat data pengguna')
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [accessToken, myAccount])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ── Fetch MQTT Worker State ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/mqtt/state')
      .then(res => res.json())
      .then(data => {
        if (typeof data.active === 'boolean') {
          setMqttConnected(data.active)
        }
      })
      .catch(() => {})
  }, [])

  // ── Notify helper ──────────────────────────────────────────────────────────
  const notify = (msg: string, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg)
    setTimeout(() => { setError(null); setSuccess(null) }, 5000)
  }

  const [selectedUser, setSelectedUser] = useState<SubAccount | null>(null)

  // ── Open modals ────────────────────────────────────────────────────────────
  const openCreate = () => { setForm(emptyForm); setSelectedUser(null); setModal('create') }
  const openEdit   = (u: SubAccount) => {
    setForm({ account: u.account, name: u.name, password: '', email: u.email ?? '', phone: u.phone ?? '', companyName: u.companyName ?? '' })
    setSelectedUser(u)
    setModal('edit')
  }
  const openDetail = (u: SubAccount) => {
    setSelectedUser(u)
    setModal('detail' as any)
  }
  const closeModal = () => { setModal(null); setSelectedUser(null); setForm(emptyForm) }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const isEdit = modal === 'edit'
      const res = await fetch('/api/users', {
        method:  isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, ...form }),
      })
      const json = await res.json()
      if (json.success) {
        notify(isEdit ? '✅ Akun berhasil diperbarui' : '✅ Akun berhasil dibuat')
        closeModal()
        fetchUsers()
      } else {
        notify(json.error || 'Gagal menyimpan', true)
      }
    } catch {
      notify('Network error', true)
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (accountTarget: string) => {
    if (!confirm(`Yakin ingin menghapus sub-account "${accountTarget}"?`)) return
    setDeleting(accountTarget)
    try {
      const res = await fetch(`/api/users?accessToken=${encodeURIComponent(accessToken || '')}&childAccount=${encodeURIComponent(accountTarget)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.success) {
        notify('✅ Akun berhasil dihapus')
        fetchUsers()
      } else {
        notify(json.error || 'Gagal menghapus', true)
      }
    } catch {
      notify('Network error', true)
    } finally {
      setDeleting(null)
    }
  }

  // ── MQTT Publishing Handler ────────────────────────────────────────────────
  const handleSendMqtt = async (accountTarget: string) => {
    setMqttSending(accountTarget)
    try {
      const res = await fetch('/api/mqtt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: accountTarget, accessToken }),
      })
      const json = await res.json()
      if (json.success) {
        notify(`✅ Berhasil mengirim lokasi ${json.publishedCount} perangkat ke MQTT broker (${json.broker})!`)
        setMqttResult(json)
      } else {
        notify(json.error || 'Gagal mengirim lokasi ke MQTT broker', true)
      }
    } catch {
      notify('Gagal terhubung ke server MQTT', true)
    } finally {
      setMqttSending(null)
    }
  }

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return (
      u.account.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.companyName ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <>
      <Topbar title="Manajemen Pengguna (Sub-Accounts)" />
      
      {/* ── Sub Navigation Header ────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <Link
          href="/users"
          className="btn btn-secondary btn-sm"
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--cyan)',
            border: '1px solid rgba(0,245,255,0.3)',
            borderRadius: 'var(--r-md)',
          }}
        >
          👥 User Management
        </Link>
        <Link
          href="/users/api-test"
          className="btn btn-ghost btn-sm"
          style={{
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid var(--bg-border)',
            borderRadius: 'var(--r-md)',
          }}
        >
          🧪 API Test Console & Debugger
        </Link>
      </div>

      {/* ── MQTT Broker Integration Panel ─────────────────────────────────── */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(0,245,255,0.06) 0%, rgba(13,13,26,0.5) 100%)',
          borderLeft: '4px solid #00F5FF',
          border: '1px solid rgba(0,245,255,0.2)',
          boxShadow: '0 4px 20px rgba(0,245,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              fontSize: 24, padding: 10, background: 'rgba(0,245,255,0.1)',
              borderRadius: 'var(--r-lg)', border: '1px solid rgba(0,245,255,0.2)'
            }}>
              📡
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                MQTT Broker Location Integration
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: mqttConnected ? 'rgba(0,255,65,0.15)' : 'rgba(255,0,64,0.15)', color: mqttConnected ? 'var(--green)' : 'var(--red)', border: mqttConnected ? '1px solid rgba(0,255,65,0.3)' : '1px solid rgba(255,0,64,0.3)', fontWeight: 800 }}>
                  {mqttConnected ? 'CONNECTED' : 'DISCONNECTED'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
                Broker: <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>36.92.47.218:14583</span> | Topik: <span style={{ color: 'var(--magenta)' }}>fleet/(imei)</span> | Interval: <span style={{ color: 'var(--yellow)' }}>10s</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              className="btn btn-secondary"
              onClick={async () => {
                const newState = !mqttConnected
                setMqttConnected(newState)
                try {
                  await fetch('/api/mqtt/state', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ active: newState })
                  })
                } catch {
                  setMqttConnected(!newState)
                  notify('Gagal mengubah status MQTT Worker', true)
                }
              }}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700,
                background: mqttConnected ? 'rgba(255,0,64,0.1)' : 'rgba(0,255,65,0.1)',
                color: mqttConnected ? 'var(--red)' : 'var(--green)',
                border: `1px solid ${mqttConnected ? 'rgba(255,0,64,0.3)' : 'rgba(0,255,65,0.3)'}`,
              }}
            >
              {mqttConnected ? '🔌 Disconnect' : '🔌 Connect'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => handleSendMqtt(myAccount || 'tengon')}
              disabled={!mqttConnected || mqttSending === (myAccount || 'tengon')}
              style={{
                padding: '10px 18px',
                fontSize: 13,
                fontWeight: 700,
                background: !mqttConnected ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #00F5FF 0%, #0077FF 100%)',
                color: !mqttConnected ? 'var(--text-muted)' : '#000',
                boxShadow: !mqttConnected ? 'none' : '0 0 16px rgba(0,245,255,0.3)',
                borderColor: !mqttConnected ? 'var(--bg-border)' : 'transparent',
              }}
            >
              {mqttSending === (myAccount || 'tengon') ? '⏳ Broadcast Ke MQTT...' : '🚀 Kirim Semua User Ke MQTT'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Theme Switcher Panel ─────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          background: 'linear-gradient(135deg, rgba(0,119,255,0.04) 0%, transparent 100%)',
          borderLeft: '4px solid var(--cyan)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-primary)' }}>🎨 Tampilan Aplikasi</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Pilih tema antarmuka yang Anda inginkan</div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setTheme('dark')}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '12px 20px', borderRadius: 'var(--r-lg)',
                border: theme === 'dark' ? '2px solid var(--cyan)' : '2px solid var(--bg-border)',
                background: theme === 'dark' ? 'rgba(0,245,255,0.08)' : 'var(--bg-elevated)',
                cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: theme === 'dark' ? '0 0 16px rgba(0,119,255,0.25)' : 'none',
                minWidth: 100,
              }}
            >
              <div style={{
                width: 60, height: 40, borderRadius: 8, background: '#070710', border: '1px solid #1A1A2E',
                display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)',
              }}>
                <div style={{ width: 8, height: 20, background: '#00F5FF', borderRadius: 2, opacity: 0.8 }} />
                <div style={{ width: 8, height: 14, background: '#BF00FF', borderRadius: 2, opacity: 0.6 }} />
                <div style={{ width: 8, height: 17, background: '#00FF41', borderRadius: 2, opacity: 0.7 }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme === 'dark' ? 'var(--cyan)' : 'var(--text-muted)' }}>🌙 Mode Gelap</div>
              {theme === 'dark' && (
                <div style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, background: 'var(--cyan)', color: '#000', fontWeight: 800 }}>AKTIF</div>
              )}
            </button>

            <button
              onClick={() => setTheme('light')}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '12px 20px', borderRadius: 'var(--r-lg)',
                border: theme === 'light' ? '2px solid var(--cyan)' : '2px solid var(--bg-border)',
                background: theme === 'light' ? 'rgba(0,119,255,0.07)' : 'var(--bg-elevated)',
                cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: theme === 'light' ? '0 0 16px rgba(0,119,255,0.2)' : 'none',
                minWidth: 100,
              }}
            >
              <div style={{
                width: 60, height: 40, borderRadius: 8, background: '#F0F4FF', border: '1px solid #D1DCF5',
                display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
              }}>
                <div style={{ width: 8, height: 20, background: '#0077FF', borderRadius: 2, opacity: 0.8 }} />
                <div style={{ width: 8, height: 14, background: '#6D28D9', borderRadius: 2, opacity: 0.6 }} />
                <div style={{ width: 8, height: 17, background: '#16A34A', borderRadius: 2, opacity: 0.7 }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: theme === 'light' ? 'var(--cyan)' : 'var(--text-muted)' }}>☀️ Mode Terang</div>
              {theme === 'light' && (
                <div style={{ fontSize: 9, padding: '2px 8px', borderRadius: 99, background: 'var(--cyan)', color: '#fff', fontWeight: 800 }}>AKTIF</div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {(error || success) && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 9999,
          background: error ? 'rgba(255,0,64,0.12)' : 'rgba(0,255,65,0.1)',
          border: `1px solid ${error ? 'rgba(255,0,64,0.35)' : 'rgba(0,255,65,0.3)'}`,
          borderRadius: 'var(--r-lg)', padding: '12px 20px',
          color: error ? 'var(--red)' : 'var(--green)',
          fontWeight: 600, fontSize: 13,
          boxShadow: error ? '0 0 20px rgba(255,0,64,0.15)' : '0 0 20px rgba(0,255,65,0.1)',
          animation: 'shimmer 0.3s ease',
        }}>
          {error || success}
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">User Management</div>
          <div className="page-subtitle">Kelola sub-account dan kirim stream posisi perangkat ke MQTT Broker</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary btn-sm" onClick={fetchUsers} disabled={loading}>
            {loading ? '⏳' : '↻'} Refresh
          </button>
          <button className="btn btn-primary" onClick={openCreate} id="btn-create-user">
            + Tambah User
          </button>
        </div>
      </div>

      {/* Search + Stats bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ maxWidth: 320 }}
          placeholder="🔍 Cari akun, nama, email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          {[
            { label: 'Total', value: users.length,                              color: 'var(--cyan)' },
            { label: 'Aktif', value: users.filter(u => u.enabledFlag === 1).length, color: 'var(--green)' },
            { label: 'Nonaktif', value: users.filter(u => u.enabledFlag !== 1).length, color: 'var(--red)' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--bg-card)', border: '1px solid var(--bg-border)',
              borderRadius: 'var(--r-md)', padding: '8px 16px', textAlign: 'center', minWidth: 80,
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: stat.color, fontFamily: 'Orbitron, monospace' }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div>Memuat data pengguna...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
              {search ? 'Tidak ada hasil pencarian' : 'Belum ada sub-account'}
            </div>
            <div style={{ fontSize: 12 }}>
              {search ? 'Coba kata kunci lain.' : 'Klik "+ Tambah User" untuk membuat sub-account pertama.'}
            </div>
          </div>
        ) : (
          <div className="table-wrap" style={{ borderRadius: 0, border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Account ID</th>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Telepon</th>
                  <th>Perusahaan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u, i) => (
                  <tr key={u.account}>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono' }}>{i + 1}</td>
                    <td>
                      <span className="mono" style={{ color: 'var(--cyan)', fontWeight: 600 }}>{u.account}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{u.name || '—'}</td>
                    <td className="mono">{u.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td className="mono">{u.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>{u.companyName || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                    <td>
                      <span className={`badge badge-${u.enabledFlag === 1 ? 'online' : 'offline'}`}>
                        {u.enabledFlag === 1 ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleSendMqtt(u.account)}
                          disabled={!mqttConnected || mqttSending === u.account}
                          title={!mqttConnected ? "Harap connect ke MQTT Broker terlebih dahulu" : "Kirim posisi perangkat user ini ke MQTT Broker 36.92.47.218:14583"}
                          style={{
                            borderColor: !mqttConnected ? 'var(--bg-border)' : 'rgba(0,245,255,0.4)',
                            color: !mqttConnected ? 'var(--text-muted)' : 'var(--cyan)',
                            background: !mqttConnected ? 'transparent' : 'rgba(0,245,255,0.06)',
                          }}
                        >
                          📡 {mqttSending === u.account ? 'Mengirim...' : 'Kirim MQTT'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openDetail(u)}
                          title="Lihat detail lengkap"
                        >👁️ Detail</button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEdit(u)}
                          title="Edit akun"
                        >✏️ Edit</button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDelete(u.account)}
                          disabled={deleting === u.account}
                          title="Hapus akun"
                        >
                          {deleting === u.account ? '⏳' : '🗑️'} Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal User Detail / Edit / Create ────────────────────────────────── */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(0,245,255,0.18)',
            borderRadius: 'var(--r-xl)',
            padding: 32,
            width: '100%', maxWidth: (modal as string) === 'detail' ? 640 : 500,
            boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,245,255,0.05)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Orbitron, monospace', letterSpacing: '0.04em' }}>
                  {(modal as string) === 'detail'
                    ? '📋 Detail Akun Jimi'
                    : modal === 'create'
                    ? '➕ Tambah User Baru'
                    : '✏️ Edit User'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                  {(modal as string) === 'detail'
                    ? `Account ID: ${selectedUser?.account}`
                    : modal === 'create'
                    ? 'Buat sub-account baru di bawah akun Anda'
                    : `Mengedit: ${form.account}`}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
                style={{ fontSize: 18, lineHeight: 1, padding: '4px 8px' }}
              >✕</button>
            </div>

            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,245,255,0.3), transparent)', marginBottom: 24 }} />

            {(modal as string) === 'detail' && selectedUser ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  background: 'var(--bg-elevated)',
                  padding: 16,
                  borderRadius: 'var(--r-lg)',
                  border: '1px solid var(--bg-border)',
                }}>
                  {[
                    { label: 'account (Account ID)', value: selectedUser.account, mono: true, color: 'var(--cyan)' },
                    { label: 'name (Nama)', value: selectedUser.name },
                    { label: 'type (Tipe)', value: selectedUser.type ?? '—', mono: true },
                    { label: 'displayFlag', value: selectedUser.displayFlag ?? '—', mono: true },
                    { label: 'userId', value: selectedUser.userId || '—', mono: true },
                    { label: 'parentId', value: selectedUser.parentId || '—', mono: true },
                    { label: 'companyName (Perusahaan)', value: selectedUser.companyName || '—' },
                    { label: 'email', value: selectedUser.email || '—', mono: true },
                    { label: 'phone (Telepon)', value: selectedUser.phone || '—', mono: true },
                    { label: 'language (Bahasa)', value: selectedUser.language || '—' },
                    { label: 'sex (Jenis Kelamin)', value: selectedUser.sex === 1 ? '1 (Laki-laki)' : selectedUser.sex === 2 ? '2 (Perempuan)' : '0 (Tidak Ditentukan)' },
                    { label: 'enabledFlag (Status)', value: selectedUser.enabledFlag === 1 ? '1 (Aktif)' : '0 (Nonaktif)', badge: true },
                    { label: 'birth (Tanggal Lahir)', value: selectedUser.birth || '—' },
                    { label: 'address (Alamat)', value: selectedUser.address || '—' },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        marginTop: 2,
                        fontFamily: item.mono ? 'JetBrains Mono, monospace' : 'inherit',
                        color: item.color || 'var(--text-primary)',
                      }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* MQTT Integration Action Card inside Detail Modal */}
                <div style={{
                  background: 'rgba(0,245,255,0.05)',
                  border: '1px solid rgba(0,245,255,0.2)',
                  borderRadius: 'var(--r-md)',
                  padding: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cyan)' }}>📡 Broadcast Lokasi Ke MQTT</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Kirim payload lokasi ke broker 36.92.47.218:14583 di topik fleet/{selectedUser.account}</div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleSendMqtt(selectedUser.account)}
                    disabled={!mqttConnected || mqttSending === selectedUser.account}
                  >
                    {mqttSending === selectedUser.account ? '⏳ Mengirim...' : '🚀 Kirim Ke MQTT'}
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                  <button className="btn btn-secondary" onClick={closeModal}>Tutup</button>
                </div>
              </div>
            ) : (

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Account ID *</label>
                <input
                  className="form-input"
                  value={form.account}
                  onChange={e => setForm(f => ({ ...f, account: e.target.value }))}
                  placeholder="Contoh: usr_001"
                  disabled={modal === 'edit'}
                  required
                  id="input-account-id"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nama Lengkap *</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nama pengguna"
                  required
                  id="input-full-name"
                />
              </div>

              {modal === 'create' && (
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <input
                    className="form-input"
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Minimal 6 karakter"
                    required
                    minLength={6}
                    id="input-password"
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="email@domain.com"
                    id="input-email"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Telepon</label>
                  <input
                    className="form-input"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+628..."
                    id="input-phone"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Perusahaan</label>
                <input
                  className="form-input"
                  value={form.companyName}
                  onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                  placeholder="PT. Contoh Indonesia"
                  id="input-company"
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving} id="btn-submit-user">
                  {saving ? '⏳ Menyimpan...' : modal === 'create' ? '✅ Buat Akun' : '✅ Simpan Perubahan'}
                </button>
              </div>
            </form>
            )}
          </div>
        </div>
      )}

      {/* ── MQTT Published Payload Inspector Modal ──────────────────────────── */}
      {mqttResult && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}
          onClick={e => { if (e.target === e.currentTarget) setMqttResult(null) }}
        >
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(0,245,255,0.3)',
            borderRadius: 'var(--r-xl)',
            padding: 32,
            width: '100%', maxWidth: 700,
            boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 24px rgba(0,245,255,0.15)',
            position: 'relative',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Orbitron, monospace', color: 'var(--cyan)' }}>
                  📡 MQTT Stream Success
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                  Broker: {mqttResult.broker} | Akun: {mqttResult.account} | Streamed: {mqttResult.publishedCount} Perangkat
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setMqttResult(null)}
                style={{ fontSize: 18, lineHeight: 1, padding: '4px 8px' }}
              >✕</button>
            </div>

            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,245,255,0.3), transparent)', marginBottom: 20 }} />

            {/* Topic Badges */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Published Topics ({mqttResult.topics?.length || 0}):
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(mqttResult.topics || []).map((t: string) => (
                  <span key={t} className="mono" style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 'var(--r-md)',
                    background: 'rgba(0,245,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,245,255,0.25)', fontWeight: 600
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Payload Code View */}
            <div style={{ position: 'relative', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Payload Data (jimi.device.location.get):
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(mqttResult.payloads, null, 2))
                    setCopyingJson(true)
                    setTimeout(() => setCopyingJson(false), 2000)
                  }}
                  style={{ fontSize: 11, padding: '3px 10px' }}
                >
                  {copyingJson ? '✅ Tersalin!' : '📋 Copy JSON'}
                </button>
              </div>
              <pre style={{
                background: '#070710',
                border: '1px solid var(--bg-border)',
                borderRadius: 'var(--r-lg)',
                padding: 16,
                fontSize: 12,
                fontFamily: 'JetBrains Mono, monospace',
                color: '#00F5FF',
                maxHeight: 320,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}>
                {JSON.stringify(mqttResult.payloads, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setMqttResult(null)}>Selesai</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
