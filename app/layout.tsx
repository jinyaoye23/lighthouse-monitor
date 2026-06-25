import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Sidebar from '@/components/layout/Sidebar'
import ToasterProvider from '@/components/ToasterProvider'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Lighthouse Monitor',
  description: '网页持续性能检测平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="flex min-h-dvh">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="px-4 md:px-6 py-4 md:py-6 max-w-7xl mx-auto pt-14 md:pt-6">
              {children}
            </div>
          </main>
        </div>
        <ToasterProvider />
      </body>
    </html>
  )
}
