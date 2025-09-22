import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Moose Mission Control',
  description: 'AI-Native Autonomous Dev Environment Control Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}