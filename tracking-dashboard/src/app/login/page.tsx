'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/authStore'

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Login failed')
      setAuth(json.data)
      router.push('/')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: 24, position: 'relative', overflow: 'hidden'
    }}>
      {/* Background glow effects */}
      <div style={{ position: 'absolute', top: '20%', left: '15%', width: 400, height: 400, background: 'rgba(0,212,255,0.06)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: 350, height: 350, background: 'rgba(123,97,255,0.07)', borderRadius: '50%', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src="/images/tracking-logo.png" alt="Tracking Aja Logo" style={{ width: 100, height: 'auto', margin: '0 auto 16px', display: 'block' }} />
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Tracking Aja</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Fleet Management Dashboard</p>

        </div>

        {/* Card */}
        <div style={{
          background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
          borderRadius: 'var(--r-xl)', padding: '32px', boxShadow: 'var(--shadow-card)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Selamat datang kembali</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>
            Masuk dengan kredensial akun Anda
          </p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="form-group">
              <label className="form-label">Akun / Nama Pengguna</label>
              <input
                id="username"
                className="form-input"
                type="text"
                placeholder="Enter your TrackSolid account"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Kata Sandi</label>
              <input
                id="password"
                className="form-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(255,69,96,0.1)', border: '1px solid rgba(255,69,96,0.3)',
                borderRadius: 'var(--r-md)', padding: '10px 14px',
                color: 'var(--red)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              id="btn-login"
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginTop: 4 }}
            >
              {loading ? (
                <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Mengautentikasi...</>
              ) : '🔐 Masuk'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: 'var(--text-muted)' }}>
          Powered by{' '}
          <a href="https://tracksolidprodocs.jimicloud.com" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--cyan)' }}>
            JIMI IoT Open API
          </a>
        </p>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
