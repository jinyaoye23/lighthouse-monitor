import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/lib/db/client'
import { getAuditRecords, getScoreTrend } from '@/lib/actions/audits'
import { RunAuditButton } from './run-audit-button'
import ScoreTrendChart from '@/components/ScoreTrendChart'
import { cn, formatDate, formatMs, getScoreColor, getScoreBgColor, CATEGORY_LABELS } from '@/lib/utils'
import { ArrowLeft, Monitor, Smartphone, Clock, ExternalLink } from 'lucide-react'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string; urlId: string }> }): Promise<Metadata> {
  const { id, urlId } = await params
  const rows = await db.select().from(schema.targetUrls).where(eq(schema.targetUrls.id, urlId))
  if (rows.length === 0) return { title: 'Not Found' }
  return { title: `${rows[0].alias || rows[0].url} — 检测记录` }
}

export default async function UrlAuditPage({ params }: { params: Promise<{ id: string; urlId: string }> }) {
  const { id: projectId, urlId } = await params

  const rows = await db.select().from(schema.targetUrls).where(eq(schema.targetUrls.id, urlId))
  if (rows.length === 0) notFound()

  const target = rows[0]
  const categories = JSON.parse(target.categories) as string[]

  const { records } = await getAuditRecords(urlId)
  const trendData = await getScoreTrend(urlId)

  // 最新一条已完成记录
  const latestCompleted = records.find(r => r.status === 'completed')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 返回链接 */}
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft size={16} />
        返回项目详情
      </Link>

      {/* URL 信息卡片 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {target.alias || target.url}
            </h1>
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              {target.url}
              <ExternalLink size={14} />
            </a>
            <div className="flex items-center gap-3 pt-1">
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                {target.device === 'mobile'
                  ? <><Smartphone size={14} /> Mobile</>
                  : <><Monitor size={14} /> Desktop</>
                }
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {categories.map(c => (
                  <span key={c} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                    {CATEGORY_LABELS[c] ?? c}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <RunAuditButton targetUrlId={urlId} projectId={projectId} urlId={urlId} />
        </div>
      </div>

      {/* 最新评分概览 */}
      {latestCompleted && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-medium text-gray-500 mb-4">最近检测结果</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['performance', 'accessibility', 'best-practices', 'seo'] as const).map(cat => {
              const score = latestCompleted[`score${cat.charAt(0).toUpperCase() + cat.slice(1)}` as keyof typeof latestCompleted] as number | null
              return (
                <div key={cat} className="text-center space-y-1">
                  <div className={cn(
                    'w-16 h-16 mx-auto rounded-full flex items-center justify-center text-2xl font-bold',
                    getScoreBgColor(score),
                    'text-white'
                  )}>
                    {score ?? '—'}
                  </div>
                  <div className="text-xs text-gray-500">{CATEGORY_LABELS[cat] ?? cat}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 趋势图 */}
      {trendData.length >= 2 && <ScoreTrendChart data={trendData} />}

      {/* 检测记录列表 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-700">
            检测记录 <span className="text-gray-400">({records.length})</span>
          </h2>
        </div>

        {records.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400">
            <p className="text-sm">暂无检测记录</p>
            <p className="text-xs mt-1">点击「运行检测」开始首次检测</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-2.5 font-medium text-gray-500">时间</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">状态</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">Perf</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">A11y</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">BP</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">SEO</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">耗时</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <Link
                        href={`/projects/${projectId}/urls/${urlId}/records/${r.id}`}
                        className="text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        {formatDate(r.createdAt)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <StatusBadge status={r.status} errorMsg={r.errorMsg ?? undefined} />
                    </td>
                    <td className={cn('px-5 py-3 font-semibold', getScoreColor(r.scorePerformance))}>
                      {r.scorePerformance ?? '—'}
                    </td>
                    <td className={cn('px-5 py-3 font-semibold', getScoreColor(r.scoreAccessibility))}>
                      {r.scoreAccessibility ?? '—'}
                    </td>
                    <td className={cn('px-5 py-3 font-semibold', getScoreColor(r.scoreBestPractices))}>
                      {r.scoreBestPractices ?? '—'}
                    </td>
                    <td className={cn('px-5 py-3 font-semibold', getScoreColor(r.scoreSeo))}>
                      {r.scoreSeo ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                      {formatMs(r.durationMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status, errorMsg }: { status: string; errorMsg?: string }) {
  const colors: Record<string, string> = {
    pending:   'bg-gray-100 text-gray-600',
    running:   'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    failed:    'bg-red-100 text-red-700',
  }
  const labels: Record<string, string> = {
    pending:   '等待中',
    running:   '运行中',
    completed: '完成',
    failed:    '失败',
  }

  return (
    <span
      className={cn('inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium', colors[status] ?? '')}
      title={errorMsg}
    >
      {labels[status] ?? status}
    </span>
  )
}
