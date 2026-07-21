'use client'
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/authStore'
import type { SubAccount } from '@/lib/api/tracksolid'

interface TopbarProps {
  title: string
  subtitle?: string
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { isAuthenticated, isAdmin, account, accessToken, contextAccount, setContextAccount } = useAuthStore()

  const [time, setTime] = useState('');
  const [subAccounts, setSubAccounts] = useState<SubAccount[]>([]);

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('id-ID'));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isAdmin && accessToken && account) {
      fetch(`/api/users?accessToken=${encodeURIComponent(accessToken)}&target=${encodeURIComponent(account)}`)
        .then(res => res.json())
        .then(json => {
          if (json.success) setSubAccounts(json.data)
        })
        .catch(console.error)
    }
  }, [isAdmin, accessToken, account]);

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
              const val = e.target.value;
              setContextAccount(val === account ? null : val);
            }}
          >
            <option value={account || ''}>[ALL] {account} (Induk)</option>
            {subAccounts.map(sub => (
              <option key={sub.account} value={sub.account}>{sub.name || sub.account}</option>
            ))}
          </select>
        </div>
      )}

      {/* Clock — always pushed to far right */}
      <div style={{
        marginLeft: isAdmin ? 16 : 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--bg-border)',
        borderRadius: 'var(--r-full)',
        padding: '5px 16px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
      }}>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>🕐</span>
        <span style={{
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.05em',
          fontFamily: 'monospace',
          color: 'var(--text-primary)',
          minWidth: 90,
          textAlign: 'center',
        }}>
          {time}
        </span>
      </div>
    </header>
  )
}

