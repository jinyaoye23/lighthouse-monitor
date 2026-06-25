'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { createProject } from '@/lib/actions/projects'

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

export default function NewProjectPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState('#6366f1')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('项目名称不能为空')
      return
    }

    setLoading(true)
    try {
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      })
      router.push(`/projects/${project.id}`)
    } catch {
      setError('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      {/* Back */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        返回项目列表
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">创建项目</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div className="space-y-2">
          <label htmlFor="name" className="text-sm font-medium">
            项目名称 <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：我的博客"
            maxLength={60}
            className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label htmlFor="desc" className="text-sm font-medium">
            描述（可选）
          </label>
          <textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简单描述这个项目用于检测哪些网页..."
            rows={3}
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
          />
        </div>

        {/* Color */}
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

        {/* Error */}
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {loading ? '创建中...' : '创建项目'}
          </button>
          <Link
            href="/projects"
            className="px-5 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            取消
          </Link>
        </div>
      </form>
    </div>
  )
}
