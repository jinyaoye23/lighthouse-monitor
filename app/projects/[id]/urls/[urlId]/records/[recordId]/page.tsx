import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAuditDetail, getScoreTrend } from '@/lib/actions/audits'
import ScoreTrendChart from '@/components/ScoreTrendChart'
import { cn, formatDate, formatMs, getScoreColor, getScoreBgColor, getScoreLabel, CATEGORY_LABELS, DEVICE_LABELS } from '@/lib/utils'
import { ArrowLeft, Clock, AlertCircle, Download, BarChart3, Zap, Monitor, Smartphone } from 'lucide-react'
import fs from 'fs'
import { parseLhr } from '@/lib/lighthouse/parser'
import type { ParsedReport } from '@/types'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string; urlId: string; recordId: string }> }): Promise<Metadata> {
  const { recordId } = await params
  const detail = await getAuditDetail(recordId)
  if (!detail) return { title: 'Not Found' }
  return { title: `${detail.targetUrl.alias || detail.targetUrl.url} — 检测详情` }
}

export default async function AuditRecordDetailPage({
  params,
}: {
  params: Promise<{ id: string; urlId: string; recordId: string }>
}) {
  const { id: projectId, urlId, recordId } = await params

  const detail = await getAuditDetail(recordId)
  if (!detail) notFound()

  const trendData = await getScoreTrend(urlId)

  // 加载完整报告
  let parsed: ParsedReport | null = null
  if (detail.reportPath && fs.existsSync(detail.reportPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(detail.reportPath, 'utf-8'))
      parsed = parseLhr(raw)
    } catch { /* ignore */ }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href={`/projects/${projectId}`} className="hover:text-gray-700 transition-colors">
          项目
        </Link>
        <span>/</span>
        <Link href={`/projects/${projectId}/urls/${urlId}`} className="hover:text-gray-700 transition-colors truncate">
          {detail.targetUrl.alias || detail.targetUrl.url}
        </Link>
        <span>/</span>
        <span className="text-gray-900">{formatDate(detail.createdAt)}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">检测详情</h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
            <span>{formatDate(detail.createdAt)}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              {detail.targetUrl.device === 'mobile' ? <Smartphone size={14} /> : <Monitor size={14} />}
              {detail.targetUrl.device === 'mobile' ? DEVICE_LABELS.mobile : DEVICE_LABELS.desktop}
            </span>
            {detail.durationMs != null && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1"><Clock size={14} />{formatMs(detail.durationMs)}</span>
              </>
            )}
          </div>
        </div>
        <div>
          <span className={cn(
            'px-3 py-1.5 rounded-lg text-sm font-medium',
            detail.status === 'completed' ? 'bg-green-100 text-green-700' :
            detail.status === 'failed' ? 'bg-red-100 text-red-700' :
            detail.status === 'running' ? 'bg-blue-100 text-blue-700' :
            'bg-gray-100 text-gray-600'
          )}>
            {detail.status === 'completed' ? '已完成' :
             detail.status === 'failed' ? '失败' :
             detail.status === 'running' ? '运行中' : '等待中'}
          </span>
        </div>
      </div>

      {/* Error */}
      {detail.status === 'failed' && detail.errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">检测失败</p>
            <p className="text-sm text-red-600 mt-1">{detail.errorMsg}</p>
          </div>
        </div>
      )}

      {/* Score Gauges */}
      {detail.status === 'completed' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(['performance', 'accessibility', 'best-practices', 'seo'] as const).map(cat => {
              const scoreKey = `score${cat.charAt(0).toUpperCase() + cat.slice(1)}` as keyof typeof detail
              const score = detail[scoreKey] as number | null
              return (
                <div key={cat} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
                  <div className={cn(
                    'w-20 h-20 mx-auto rounded-full flex items-center justify-center',
                    getScoreBgColor(score),
                    'text-white'
                  )}>
                    <div>
                      <div className="text-3xl font-bold">{score ?? '—'}</div>
                      <div className="text-xs opacity-80">/ 100</div>
                    </div>
                  </div>
                  <div className="mt-3 text-sm font-medium text-gray-700">{CATEGORY_LABELS[cat]}</div>
                  <div className="text-xs text-gray-400">{getScoreLabel(score)}</div>
                </div>
              )
            })}
          </div>

          {/* Web Vitals */}
          {parsed && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                <Zap size={16} className="text-amber-500" />
                Web Vitals
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {([
                  ['首次内容渲染 (FCP)', parsed.vitals.fcp, 'ms'],
                  ['最大内容渲染 (LCP)', parsed.vitals.lcp, 'ms'],
                  ['总阻塞时间 (TBT)',  parsed.vitals.tbt, 'ms'],
                  ['累计布局偏移 (CLS)', parsed.vitals.cls, ''],
                  ['速度指数 (SI)',     parsed.vitals.si,  'ms'],
                  ['可交互时间 (TTI)',  parsed.vitals.tti, 'ms'],
                ] as const).map(([label, value, unit]) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">{label}</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {value != null ? value : '—'}
                      {unit && value != null ? <span className="text-xs text-gray-400 ml-0.5">{unit}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Opportunities */}
          {parsed && parsed.opportunities.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-4">优化机会 ({parsed.opportunities.length})</h2>
              <div className="space-y-2">
                {parsed.opportunities.slice(0, 10).map(op => (
                  <div key={op.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className={cn(
                      'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                      getScoreBgColor(op.score)
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{op.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{op.description}</p>
                    </div>
                    {op.numericValue != null && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">{formatMs(op.numericValue)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diagnostics */}
          {parsed && parsed.diagnostics.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h2 className="text-sm font-medium text-gray-700 mb-4">诊断信息 ({parsed.diagnostics.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {parsed.diagnostics.map(d => (
                  <div key={d.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-700">{d.title}</p>
                      <p className="text-xs text-gray-500">{d.description}</p>
                    </div>
                    {d.displayValue && (
                      <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{d.displayValue}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 趋势图 */}
          {trendData.length >= 2 && <ScoreTrendChart data={trendData} />}
        </>
      )}

      {/* Running */}
      {detail.status === 'running' && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">检测正在运行中，请稍候...</p>
        </div>
      )}
    </div>
  )
}
