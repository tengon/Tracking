'use client'
import { useEffect, useState, useCallback } from 'react'
import Topbar from '@/components/layout/Topbar'
import { useAuthStore } from '@/lib/store/authStore'
import type { SubAccount } from '@/lib/api/tracksolid'

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
  const [users,    setUsers]    = useState<SubAccount[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)
  const [search,   setSearch]   = useState('')
  const [modal,    setModal]    = useState<ModalMode>(null)
  const [form,     setForm]     = useState<FormState>(emptyForm)
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

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

  // ── Notify helper ──────────────────────────────────────────────────────────
  const notify = (msg: string, isErr = false) => {
    if (isErr) setError(msg); else setSuccess(msg)
    setTimeout(() => { setError(null); setSuccess(null) }, 4000)
  }

  // ── Open modals ────────────────────────────────────────────────────────────
  const openCreate = () => { setForm(emptyForm); setModal('create') }
  const openEdit   = (u: SubAccount) => {
    setForm({ account: u.account, name: u.name, password: '', email: u.email ?? '', phone: u.phone ?? '', companyName: u.companyName ?? '' })
    setModal('edit')
  }
  const closeModal = () => { setModal(null); setForm(emptyForm) }

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
  const handleDelete = async (acc: string) => {
    if (!confirm(`Hapus akun "${acc}"? Tindakan ini tidak dapat dibatalkan.`)) return
    setDeleting(acc)
    try {
      const res = await fetch('/api/users', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, account: acc }),
      })
      const json = await res.json()
      if (json.success) { notify('✅ Akun berhasil dihapus'); fetchUsers() }
      else notify(json.error || 'Gagal menghapus', true)
    } catch {
      notify('Network error', true)
    } finally {
      setDeleting(null)
    }
  }

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = users.filter(u =>
    !search ||
    u.account?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.companyName?.toLowerCase().includes(search.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <Topbar
        title="User Management"
        subtitle={`${users.length} sub-account terdaftar`}
      />

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
          <div className="page-subtitle">Kelola sub-account yang berada di bawah akun Anda</div>
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
                      <div style={{ display: 'flex', gap: 6 }}>
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

      {/* ── Modal ────────────────────────────────────────────────────────────── */}
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
            width: '100%', maxWidth: 500,
            boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,245,255,0.05)',
            position: 'relative',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Orbitron, monospace', letterSpacing: '0.04em' }}>
                  {modal === 'create' ? '➕ Tambah User Baru' : '✏️ Edit User'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                  {modal === 'create' ? 'Buat sub-account baru di bawah akun Anda' : `Mengedit: ${form.account}`}
                </div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
                style={{ fontSize: 18, lineHeight: 1, padding: '4px 8px' }}
              >✕</button>
            </div>

            {/* Cyan divider */}
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(0,245,255,0.3), transparent)', marginBottom: 24 }} />

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Account ID — only editable on create */}
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
                {modal === 'edit' && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Account ID tidak dapat diubah setelah dibuat.</div>
                )}
              </div>

              {/* Name */}
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

              {/* Password — only on create */}
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
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Password akan di-hash MD5 sebelum dikirim ke API.</div>
                </div>
              )}

              {/* Email + Phone */}
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

              {/* Company */}
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

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn btn-ghost" onClick={closeModal}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={saving} id="btn-submit-user">
                  {saving ? '⏳ Menyimpan...' : modal === 'create' ? '✅ Buat Akun' : '✅ Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
