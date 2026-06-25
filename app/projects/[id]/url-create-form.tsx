'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { createTargetUrl } from '@/lib/actions/urls'

export default function UrlCreateForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [alias, setAlias] = useState('')
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [categories, setCategories] = useState<string[]>(['performance', 'accessibility', 'best-practices', 'seo'])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const categoryOptions = [
    { value: 'performance', label: 'Performance' },
    { value: 'accessibility', label: 'Accessibility' },
    { value: 'best-practices', label: 'Best Practices' },
    { value: 'seo', label: 'SEO' },
  ]

  function toggleCategory(cat: string) {
    if (categories.includes(cat)) {
      if (categories.length > 1) setCategories(categories.filter((c) => c !== cat))
    } else {
      setCategories([...categories, cat])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!url.trim()) {
      setError('请输入 URL')
      return
    }

    // Basic URL validation
    try {
      new URL(url.trim())
    } catch {
      setError('请输入有效的 URL（以 http:// 或 https:// 开头）')
      return
    }

    setLoading(true)
    try {
      await createTargetUrl({
        projectId,
        url: url.trim(),
        alias: alias.trim() || undefined,
        device,
        categories,
      })
      setOpen(false)
      setUrl('')
      setAlias('')
      setDevice('mobile')
      setCategories(['performance', 'accessibility', 'best-practices', 'seo'])
      router.refresh()
    } catch {
      setError('添加失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
      >
        <Plus className="w-4 h-4" />
        添加 URL
      </button>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-border bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">添加检测 URL</h3>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* URL */}
        <div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="w-full h-9 px-3 rounded-lg border border-border bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Alias */}
        <div>
          <input
            type="text"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="别名（可选，如：首页、产品页）"
            maxLength={30}
            className="w-full h-9 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>

        {/* Device */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">设备：</span>
          {(['mobile', 'desktop'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                device === d
                  ? 'bg-primary text-white'
                  : 'bg-white border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {d === 'mobile' ? '📱 Mobile' : '🖥 Desktop'}
            </button>
          ))}
        </div>

        {/* Categories */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground mr-1">类别：</span>
          {categoryOptions.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => toggleCategory(c.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                categories.includes(c.value)
                  ? 'bg-primary/10 text-primary border border-primary/30'
                  : 'bg-white border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* Submit */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {loading ? '添加中...' : '添加'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="px-4 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            取消
          </button>
        </div>
      </form>
    </div>
  )
}
