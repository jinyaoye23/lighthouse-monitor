'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteProject } from '@/lib/actions/projects'

export default function DeleteButton({
  projectId,
  projectName,
}: {
  projectId: string
  projectName: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    await deleteProject(projectId)
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="px-2 py-1 rounded text-xs font-medium bg-red-500 text-white hover:bg-red-600 disabled:opacity-50"
        >
          {loading ? '删除中...' : '确认'}
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
      className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
      title="删除"
    >
      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-500" />
    </button>
  )
}
