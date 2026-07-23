import type { Metadata } from 'next'
import './globals.css'
import LayoutShell from '@/components/layout/LayoutShell'
import ThemeProvider from '@/components/layout/ThemeProvider'

export const metadata: Metadata = {
  title: 'Fleet Dashboard',
  description: 'Real-time GPS Fleet Tracking Dashboard',
  keywords: 'fleet tracking, GPS, vehicle tracking',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <ThemeProvider>
          <LayoutShell>{children}</LayoutShell>
        </ThemeProvider>
      </body>
    </html>
  )
}
