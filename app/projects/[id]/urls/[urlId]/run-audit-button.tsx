'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { toast } from 'sonner'
import { triggerAudit } from '@/lib/actions/audits'

export function RunAuditButton({ targetUrlId, projectId, urlId }: { targetUrlId: string; projectId: string; urlId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleRun = () => {
    startTransition(async () => {
      try {
        const result = await triggerAudit(targetUrlId)
        toast.success('检测已完成')
        router.push(`/projects/${projectId}/urls/${urlId}/records/${result.recordId}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '检测执行失败，请重试')
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
      {pending ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          检测中...
        </>
      ) : (
        <>
          <Play size={16} />
          运行检测
        </>
      )}
    </button>
  )
}
