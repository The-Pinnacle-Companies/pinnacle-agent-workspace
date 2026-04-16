import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'Pinnacle AI Workspace',
  description: 'Pinnacle AI Agent Workspace — your intelligent team interface',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0f0f10" />
      </head>
      <body className="bg-[#0f0f10] text-[#f0f0f2] antialiased min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
