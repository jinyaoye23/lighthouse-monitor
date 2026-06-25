'use client'

import { Toaster } from 'sonner'

export default function ToasterProvider() {
  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      duration={3000}
      toastOptions={{
        style: {
          borderRadius: '12px',
          border: '1px solid var(--border)',
          background: 'var(--background)',
          color: 'var(--foreground)',
        },
      }}
    />
  )
}
