import Link from 'next/link'
import { desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { auditRecords, targetUrls, projects } from '@/lib/db/schema'
import { cn, formatDate, formatMs, getScoreColor, DEVICE_LABELS } from '@/lib/utils'
import { Activity, ExternalLink, Search } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function AuditsPage() {
  const rows = await db.select({
    record: auditRecords,
    url: {
      id: targetUrls.id,
      url: targetUrls.url,
      alias: targetUrls.alias,
      device: targetUrls.device,
      projectId: targetUrls.projectId,
    },
    project: {
      id: projects.id,
      name: projects.name,
      color: projects.color,
    },
  })
    .from(auditRecords)
    .innerJoin(targetUrls, sql`${auditRecords.targetUrlId} = ${targetUrls.id}`)
    .innerJoin(projects, sql`${targetUrls.projectId} = ${projects.id}`)
    .orderBy(desc(auditRecords.createdAt))
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">检测记录</h1>
        <p className="text-gray-500 mt-1 text-sm">所有项目的最新检测记录一览</p>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium mb-1">暂无检测记录</h3>
          <p className="text-gray-500 text-sm">创建项目并添加检测 URL 后，执行检测即可在此查看记录</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-5 py-2.5 font-medium text-gray-500">时间</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">项目</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">URL</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">设备</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">性能</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">可访问性</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">最佳实践</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">SEO</th>
                  <th className="px-5 py-2.5 font-medium text-gray-500">耗时</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(({ record: r, url: u, project: p }) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 whitespace-nowrap">
                      <Link
                        href={`/projects/${p.id}/urls/${u.id}/records/${r.id}`}
                        className="text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        {formatDate(r.createdAt)}
                      </Link>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: p.color ?? '#6366f1' }}
                        />
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-gray-700 hover:text-indigo-600 transition-colors"
                        >
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-3 max-w-xs truncate">
                      <span className="text-gray-600" title={u.url}>
                        {u.alias || u.url}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                      {u.device === 'mobile' ? `📱 ${DEVICE_LABELS.mobile}` : `🖥 ${DEVICE_LABELS.desktop}`}
                    </td>
                    <td className={cn('px-5 py-3 font-semibold', getScoreColor(r.scorePerformance ?? null))}>
                      {r.scorePerformance ?? '—'}
                    </td>
                    <td className={cn('px-5 py-3 font-semibold', getScoreColor(r.scoreAccessibility ?? null))}>
                      {r.scoreAccessibility ?? '—'}
                    </td>
                    <td className={cn('px-5 py-3 font-semibold', getScoreColor(r.scoreBestPractices ?? null))}>
                      {r.scoreBestPractices ?? '—'}
                    </td>
                    <td className={cn('px-5 py-3 font-semibold', getScoreColor(r.scoreSeo ?? null))}>
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
        </div>
      )}
    </div>
  )
}
