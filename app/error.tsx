'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] text-center">
      <h1 className="text-6xl font-bold text-gray-200">500</h1>
      <h2 className="text-xl font-semibold mt-4 text-gray-900">出了点问题</h2>
      <p className="text-sm text-gray-500 mt-2">页面加载时遇到了错误，请重试</p>
      <button
        onClick={reset}
        className="mt-6 inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        重试
      </button>
    </div>
  )
}
