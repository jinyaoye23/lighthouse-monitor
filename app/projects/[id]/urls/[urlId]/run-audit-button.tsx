'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { triggerAudit } from '@/lib/actions/audits'

export function RunAuditButton({ targetUrlId }: { targetUrlId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleRun = () => {
    startTransition(async () => {
      try {
        const result = await triggerAudit(targetUrlId)
        // Navigate to the record detail page
        router.push(`records/${result.recordId}`)
      } catch (err) {
        alert(err instanceof Error ? err.message : '检测失败')
      }
    })
  }

  return (
    <button
      onClick={handleRun}
      disabled={pending}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium
                 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
    >
      <Play size={16} />
      {pending ? '检测中...' : '运行检测'}
    </button>
  )
}
