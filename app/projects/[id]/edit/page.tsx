'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'
import { getProject, updateProject } from '@/lib/actions/projects'

const COLOR_OPTIONS = [
  { value: '#6366f1', label: '靛蓝' },
  { value: '#3b82f6', label: '蓝' },
  { value: '#10b981', label: '绿' },
  { value: '#f59e0b', label: '黄' },
  { value: '#ef4444', label: '红' },
  { value: '#8b5cf6', label: '紫' },
  { value: '#ec4899', label: '粉' },
  { value: '#06b6d4', label: '青' },
]

export default function EditProjectPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  // Load project data
  useEffect(() => {
    paramsPromise.then(async ({ id }) => {
      const project = await getProject(id)
      if (!project) {
        router.push('/projects')
        return
      }
      setName(project.name)
      setDescription(project.description || '')
      setColor(project.color || '#6366f1')
      setReady(true)
    })
  }, [paramsPromise, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('项目名称不能为空')
      return
    }

    const { id } = await paramsPromise

    setLoading(true)
    try {
      await updateProject(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      })
      router.push(`/projects/${id}`)
      router.refresh()
    } catch {
      setError('更新失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const { id } = { id: '' } // will be set by useEffect, fallback for render

  if (!ready) {
    return (
      <div className="max-w-lg">
        <p className="text-muted-foreground text-sm">加载中...</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      {/* Back */}
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        返回项目详情
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">编辑项目</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            项目名称 <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="desc" className="text-sm font-medium">
            描述（可选）
          </label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">标识色</label>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                className="relative w-8 h-8 rounded-full transition-transform hover:scale-110"
                style={{ backgroundColor: c.value }}
                title={c.label}
              >
                {color === c.value && (
                  <span className="absolute inset-0 rounded-full ring-2 ring-offset-2 ring-offset-white ring-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {loading ? '保存中...' : '保存修改'}
          </button>
          <Link
            href={`/projects/${id}`}
            className="px-5 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  )
}
