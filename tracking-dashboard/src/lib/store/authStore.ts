import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthStore } from '@/lib/api/types'

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      account: null,
      contextAccount: null,
      isAdmin: false,
      isAuthenticated: false,
      setContextAccount: (account: string | null) => set({ contextAccount: account }),
      setAuth: (token) => set({
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: Date.now() + (token.expiresIn * 1000),
        account: token.account,
        contextAccount: null,
        isAdmin: token.account === '754269', // Mark as admin based on specific account
        isAuthenticated: true,
      }),
      clearAuth: () => set({
        accessToken: null, refreshToken: null,
        expiresAt: null, account: null, contextAccount: null, isAdmin: false, isAuthenticated: false,
      }),
    }),
    { name: 'tracksolid-auth' }
  )
)
