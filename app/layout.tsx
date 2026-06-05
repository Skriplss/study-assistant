import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Study Assistant',
  description:
    'Transform how you organize and engage with study materials using AI',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
