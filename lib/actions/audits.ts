'use server'

import { db } from '@/lib/db/client'
import { auditRecords, targetUrls, projects } from '@/lib/db/schema'
import { eq, desc, and, sql, asc } from 'drizzle-orm'
import type { AuditRecord, AuditDetail, AuditRecordPage, PaginationOpts } from '@/types'
import { runLighthouseAudit } from '@/lib/lighthouse/runner'

/** 获取某 URL 的所有检测记录 */
export async function getAuditRecords(
  targetUrlId: string,
  opts: PaginationOpts = {}
): Promise<AuditRecordPage> {
  const { page = 1, pageSize = 20, startDate, endDate } = opts

  const conditions = [eq(auditRecords.targetUrlId, targetUrlId)]
  if (startDate) conditions.push(sql`${auditRecords.createdAt} >= ${Math.floor(startDate.getTime() / 1000)}`)
  if (endDate)   conditions.push(sql`${auditRecords.createdAt} <= ${Math.floor(endDate.getTime() / 1000)}`)

  const [rows, countResult] = await Promise.all([
    db.select().from(auditRecords)
      .where(and(...conditions))
      .orderBy(desc(auditRecords.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: sql<number>`count(*)` }).from(auditRecords)
      .where(and(...conditions)),
  ])

  const total = Number(countResult[0]?.count ?? 0)

  return {
    records: rows.map(mapAuditRecord),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/** 获取单条检测记录 */
export async function getAuditRecord(id: string): Promise<AuditRecord | null> {
  const rows = await db.select().from(auditRecords).where(eq(auditRecords.id, id))
  if (rows.length === 0) return null
  return mapAuditRecord(rows[0])
}

/** 获取检测详情（含 URL 和项目信息） */
export async function getAuditDetail(id: string): Promise<AuditDetail | null> {
  const rows = await db.select().from(auditRecords)
    .innerJoin(targetUrls, eq(auditRecords.targetUrlId, targetUrls.id))
    .innerJoin(projects, eq(targetUrls.projectId, projects.id))
    .where(eq(auditRecords.id, id))

  if (rows.length === 0) return null
  const r = rows[0]
  return {
    ...mapAuditRecord(r.audit_records),
    targetUrl: {
      id: r.target_urls.id,
      projectId: r.target_urls.projectId,
      url: r.target_urls.url,
      alias: r.target_urls.alias ?? null,
      device: r.target_urls.device as 'mobile' | 'desktop',
      categories: r.target_urls.categories,
      timeoutSecs: r.target_urls.timeoutSecs ?? 60,
      createdAt: r.target_urls.createdAt,
      updatedAt: r.target_urls.updatedAt,
    },
    project: {
      id: r.projects.id,
      name: r.projects.name,
      description: r.projects.description ?? null,
      color: r.projects.color ?? null,
      createdAt: r.projects.createdAt,
      updatedAt: r.projects.updatedAt,
    },
  }
}

/** 某 URL 的分数趋势数据（用于图表） */
export async function getScoreTrend(
  targetUrlId: string,
  limit = 30
): Promise<{ date: string; performance: number | null; accessibility: number | null; bestPractices: number | null; seo: number | null }[]> {
  const rows = await db.select({
    createdAt: auditRecords.createdAt,
    scorePerformance: auditRecords.scorePerformance,
    scoreAccessibility: auditRecords.scoreAccessibility,
    scoreBestPractices: auditRecords.scoreBestPractices,
    scoreSeo: auditRecords.scoreSeo,
  })
    .from(auditRecords)
    .where(
      and(
        eq(auditRecords.targetUrlId, targetUrlId),
        eq(auditRecords.status, 'completed'),
      )
    )
    .orderBy(asc(auditRecords.createdAt))
    .limit(limit)

  return rows.map(r => ({
    date: r.createdAt.toISOString().slice(0, 10),
    performance: r.scorePerformance,
    accessibility: r.scoreAccessibility,
    bestPractices: r.scoreBestPractices,
    seo: r.scoreSeo,
  }))
}

/** 手动触发检测 */
export async function triggerAudit(targetUrlId: string): Promise<{ recordId: string }> {
  return runLighthouseAudit({ targetUrlId, triggeredBy: 'manual' })
}

/** 删除检测记录 */
export async function deleteAuditRecord(id: string): Promise<void> {
  await db.delete(auditRecords).where(eq(auditRecords.id, id))
}

// ── helpers ──

function mapAuditRecord(r: typeof auditRecords.$inferSelect): AuditRecord {
  return {
    id: r.id,
    targetUrlId: r.targetUrlId,
    status: r.status as AuditRecord['status'],
    scorePerformance: r.scorePerformance ?? null,
    scoreAccessibility: r.scoreAccessibility ?? null,
    scoreBestPractices: r.scoreBestPractices ?? null,
    scoreSeo: r.scoreSeo ?? null,
    fcp: r.fcp ?? null,
    lcp: r.lcp ?? null,
    tbt: r.tbt ?? null,
    cls: r.cls ?? null,
    si: r.si ?? null,
    tti: r.tti ?? null,
    reportPath: r.reportPath ?? null,
    reportHtmlPath: r.reportHtmlPath ?? null,
    errorMsg: r.errorMsg ?? null,
    durationMs: r.durationMs ?? null,
    createdAt: r.createdAt,
    completedAt: r.completedAt ?? null,
  }
}
