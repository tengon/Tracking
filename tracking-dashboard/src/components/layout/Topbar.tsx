'use client'
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore'
import type { SubAccount } from '@/lib/api/tracksolid'

interface TopbarProps {
  title: string
  subtitle?: string
  lastUpdate?: Date | null
}

// Format tanggal + waktu sesuai locale lokal browser
const fmtTime = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

const fmtDateTime = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

export default function Topbar({ title, subtitle, lastUpdate }: TopbarProps) {
  const { isAuthenticated, isAdmin, account, accessToken, contextAccount, setContextAccount } = useAuthStore()

  const [time, setTime] = useState('')
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([])

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (isAdmin && accessToken && account) {
      fetch(`/api/users?accessToken=${encodeURIComponent(accessToken)}&target=${encodeURIComponent(account)}`)
        .then(res => res.json())
        .then(json => {
          if (json.success) setSubAccounts(json.data)
        })
        .catch(console.error)
    }
  }, [isAdmin, accessToken, account])

  return (
    <header className="topbar">
      <div>
        <div className="topbar-title">{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{subtitle}</div>}
      </div>

      {isAdmin && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Viewing as:</span>
          <select
            className="form-input"
            style={{ width: 'auto', padding: '4px 28px 4px 12px', fontSize: 12 }}
            value={contextAccount || account || ''}
            onChange={(e) => {
              const val = e.target.value
              setContextAccount(val === account ? null : val)
            }}
          >
            <option value={account || ''}>[ALL] {account} (Induk)</option>
            {subAccounts.map(sub => (
              <option key={sub.account} value={sub.account}>{sub.name || sub.account}</option>
            ))}
          </select>
        </div>
      )}

      {/* Right Controls: User info + Divider + Clock + Last Update */}
      <div style={{ marginLeft: isAdmin ? 16 : 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Logged in User Widget */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--text-secondary)',
          background: 'rgba(0, 119, 255, 0.06)',
          border: '1px solid rgba(0, 119, 255, 0.18)',
          borderRadius: 'var(--r-full)',
          padding: '5px 14px',
          boxShadow: '0 1px 6px rgba(0,119,255,0.06)',
        }}>
          <span style={{ fontSize: 13 }}>👤</span>
          <span style={{ color: 'var(--text-muted)' }}>Logged in as</span>
          <span style={{ color: 'var(--cyan)', fontWeight: 700, fontFamily: 'monospace' }}>{account || '—'}</span>
        </div>

        {/* Vertical Divider */}
        <div style={{ width: 1, height: 20, background: 'var(--bg-border)' }} />

        {/* Clock + Last Update stacked */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--bg-border)',
          borderRadius: 'var(--r-lg)',
          padding: '5px 16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          gap: 1,
        }}>
          {/* Jam */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🕐</span>
            <span style={{
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.05em',
              fontFamily: 'monospace',
              color: 'var(--text-primary)',
              minWidth: 82,
              textAlign: 'center',
            }}>
              {time}
            </span>
          </div>

          {/* Last Update — hanya ditampilkan jika prop lastUpdate ada */}
          {lastUpdate ? (
            <div style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              fontFamily: 'monospace',
              letterSpacing: '0.02em',
              textAlign: 'center',
              marginTop: 1,
            }}>
              ↻ {lastUpdate.toLocaleTimeString(undefined, {
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
              })}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
