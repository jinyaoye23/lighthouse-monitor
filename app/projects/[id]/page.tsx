import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit, Globe, Smartphone, Monitor, BarChart3, ExternalLink } from 'lucide-react'
import { getProject } from '@/lib/actions/projects'
import { getTargetUrls } from '@/lib/actions/urls'
import { CATEGORY_LABELS } from '@/lib/utils'
import UrlCreateForm from './url-create-form'
import UrlDeleteButton from './url-delete-button'

export default async function ProjectDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await paramsPromise
  const project = await getProject(id)
  if (!project) notFound()

  const urls = await getTargetUrls(id)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        项目列表
      </Link>

      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (project.color || '#6366f1') + '15' }}
          >
            <BarChart3 className="w-5 h-5" style={{ color: project.color || '#6366f1' }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-muted-foreground text-sm mt-1">{project.description}</p>
            )}
          </div>
        </div>
        <Link
          href={`/projects/${id}/edit`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
        >
          <Edit className="w-3.5 h-3.5" />
          编辑
        </Link>
      </div>

      {/* URL Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">
            <Globe className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            检测 URL
            <span className="text-muted-foreground text-sm font-normal ml-2">
              ({urls.length})
            </span>
          </h2>
        </div>

        {/* Create URL Form */}
        <UrlCreateForm projectId={id} />

        {/* URL List */}
        {urls.length > 0 && (
          <div className="space-y-3 mt-4">
            {urls.map((url) => {
              const categories: string[] = JSON.parse(url.categories)
              return (
                <div
                  key={url.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-border bg-white hover:shadow-sm transition-shadow group"
                >
                  {/* Device icon */}
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    {url.device === 'mobile' ? (
                      <Smartphone className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Monitor className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>

                  {/* URL info — clickable */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/projects/${id}/urls/${url.id}`}
                      className="flex items-center gap-2 group/link"
                    >
                      <span className="font-mono text-sm truncate max-w-md group-hover/link:text-indigo-600 transition-colors" title={url.url}>
                        {url.url}
                      </span>
                      {url.alias && (
                        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                          {url.alias}
                        </span>
                      )}
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                    </Link>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {url.device === 'mobile' ? '📱 Mobile' : '🖥 Desktop'}
                      </span>
                      {categories.map((cat) => (
                        <span
                          key={cat}
                          className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full"
                        >
                          {CATEGORY_LABELS[cat] || cat}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      href={`/projects/${id}/urls/${url.id}`}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
                    >
                      检测
                    </Link>
                    <UrlDeleteButton
                      urlId={url.id}
                      urlAlias={url.alias || url.url}
                      projectId={id}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* No URLs tip */}
        {urls.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
            <Globe className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">还没有添加检测 URL</p>
            <p className="text-muted-foreground text-xs mt-1">在上方添加第一个 URL 开始检测</p>
          </div>
        )}
      </div>
    </div>
  )
}
