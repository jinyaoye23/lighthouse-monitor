import Link from 'next/link'
import { FolderOpen, Plus, MoreHorizontal, Trash2, ExternalLink, Edit } from 'lucide-react'
import { getProjects, deleteProject } from '@/lib/actions/projects'
import { getScoreColor, getScoreBgColor, formatDate } from '@/lib/utils'
import DeleteButton from './delete-button'

export default async function ProjectsPage() {
  const projects = await getProjects()

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
      {projects.length === 0 ? (
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
      ) : (
        /* Project Cards */
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.id}
              className="group relative rounded-xl border border-border bg-white hover:shadow-md transition-all"
            >
              {/* Color bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1 rounded-t-xl"
                style={{ backgroundColor: project.color || '#6366f1' }}
              />
              <div className="p-5 pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/projects/${project.id}`} className="hover:underline">
                      <h3 className="font-semibold truncate">{project.name}</h3>
                    </Link>
                    {project.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                  {/* Inline actions on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <Link
                      href={`/projects/${project.id}/edit`}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="编辑"
                    >
                      <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                    </Link>
                    <DeleteButton projectId={project.id} projectName={project.name} />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="inline-flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    <span className="font-mono">{project.urlCount}</span> URL
                  </span>
                  {project.avgScore !== null && (
                    <span className="inline-flex items-center gap-1">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white ${getScoreBgColor(project.avgScore)}`}
                      >
                        {project.avgScore}
                      </span>
                      <span className={getScoreColor(project.avgScore)}>avg</span>
                    </span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {project.lastAuditAt
                      ? `最近检测: ${formatDate(project.lastAuditAt)}`
                      : '暂未检测'}
                  </span>
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    查看详情 →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
