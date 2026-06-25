'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteTargetUrl } from '@/lib/actions/urls'

export default function UrlDeleteButton({
  urlId,
  urlAlias,
  projectId,
}: {
  urlId: string
  urlAlias: string
  projectId: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    try {
      await deleteTargetUrl(urlId)
      toast.success(`URL「${urlAlias}」已删除`)
      router.refresh()
    } catch {
      toast.error('删除失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1 ml-2">
        <span className="text-xs text-muted-foreground">确认删除?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-2 py-1 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? '...' : '确认'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted"
        >
          取消
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-1.5 rounded-md hover:bg-red-50 transition-colors ml-1"
      title="删除"
    >
      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
    </button>
  )
}
