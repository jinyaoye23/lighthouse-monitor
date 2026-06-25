import Link from 'next/link'
import { FolderOpen, Plus } from 'lucide-react'

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">项目列表</h1>
          <p className="text-muted-foreground mt-1">管理你的性能检测项目</p>
        </div>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          创建项目
        </Link>
      </div>

      {/* Empty State */}
      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <FolderOpen className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">还没有项目</h3>
        <p className="text-muted-foreground text-sm mb-6">创建第一个项目开始检测网页性能</p>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          创建第一个项目
        </Link>
      </div>
    </div>
  )
}
