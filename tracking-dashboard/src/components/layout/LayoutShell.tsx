'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuthStore } from '@/lib/store/authStore'
import Sidebar from './Sidebar'

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, expiresAt } = useAuthStore()
  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (!isAuthenticated && !isLoginPage) {
      router.push('/login')
    }
    if (isAuthenticated && expiresAt && Date.now() > expiresAt) {
      useAuthStore.getState().clearAuth()
      router.push('/login')
    }
  }, [isAuthenticated, isLoginPage, expiresAt, router])

  if (isLoginPage) return <>{children}</>

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  )
}
