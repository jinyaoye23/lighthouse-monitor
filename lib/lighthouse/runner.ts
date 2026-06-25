/**
 * Lighthouse 程序化运行器
 *
 * 注意：lighthouse 返回的 LHR 包含 URL（`configSettings.emulatedFormFactor`、`finalDisplayedUrl` 等），
 * 但不会泄露任何凭据。JSON 报告保存到 data/reports/ 目录。
 */
import { db, schema } from '@/lib/db/client'
import { auditRecords, targetUrls } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import fs from 'fs'
import path from 'path'
import { parseLhr } from './parser'

const REPORTS_DIR = path.join(process.cwd(), 'data', 'reports')

function ensureReportDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true })
  }
}

export interface RunOptions {
  targetUrlId: string
  /** Triggered by user via UI */
  triggeredBy?: 'manual'
}

export async function runLighthouseAudit(opts: RunOptions): Promise<{ recordId: string }> {
  const { targetUrlId } = opts

  // 1. 查找 URL 信息
  const urls = await db.select().from(schema.targetUrls).where(eq(schema.targetUrls.id, targetUrlId))
  if (urls.length === 0) throw new Error(`TargetUrl ${targetUrlId} not found`)
  const target = urls[0]

  // 2. 创建 pending 记录
  const recordId = nanoid()
  const now = Date.now()
  await db.insert(schema.auditRecords).values({
    id: recordId,
    targetUrlId,
    status: 'running',
    createdAt: new Date(now),
  })

  const start = performance.now()

  try {
    // 3. 动态 import lighthouse（ESM-only，避免 Next.js 编译阶段导入）
    const lighthouse = await import('lighthouse')
    const chromeLauncher = await import('chrome-launcher')

    const ReportGenerator = (lighthouse as any).default ?? lighthouse

    const chrome = await chromeLauncher.launch({
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
    })

    const categories = JSON.parse(target.categories) as string[]
    const flags: Record<string, unknown> = {
      port: chrome.port,
      output: ['json', 'html'],
      onlyCategories: categories,
      formFactor: target.device,
      screenEmulation: {
        mobile: target.device === 'mobile',
        width: target.device === 'mobile' ? 375 : 1350,
        height: target.device === 'mobile' ? 812 : 940,
        deviceScaleFactor: 1,
        disabled: false,
      },
    }

    const runnerResult = await ReportGenerator(target.url, flags)

    // 4. 提取 LHR 和报告
    const lhr = runnerResult?.lhr ?? runnerResult
    if (!lhr) throw new Error('Lighthouse returned empty result')

    // output: ['json', 'html'] 时，runnerResult.report 是 [jsonStr, htmlStr]
    const reports = runnerResult?.report
    const jsonStr = Array.isArray(reports) ? reports[0] : (typeof reports === 'string' ? reports : JSON.stringify(lhr))
    const htmlStr = Array.isArray(reports) ? (reports[1] ?? null) : null

    const parsed = parseLhr(lhr)

    // 5. 保存 JSON 报告
    ensureReportDir()
    const reportPath = path.join(REPORTS_DIR, `${recordId}.json`)
    fs.writeFileSync(reportPath, typeof jsonStr === 'string' ? jsonStr : JSON.stringify(jsonStr, null, 2), 'utf-8')

    // 5b. 保存 HTML 报告
    let htmlReportPath: string | null = null
    if (htmlStr && typeof htmlStr === 'string') {
      const htmlPath = path.join(REPORTS_DIR, `${recordId}.html`)
      fs.writeFileSync(htmlPath, htmlStr, 'utf-8')
      htmlReportPath = htmlPath
    } else {
      console.warn('Lighthouse HTML report not generated — output array may not be supported in this version')
    }

    const elapsed = Math.round(performance.now() - start)
    await chrome.kill()

    // 6. 更新 DB 记录
    await db.update(schema.auditRecords)
      .set({
        status: 'completed',
        scorePerformance:    parsed.scores.performance,
        scoreAccessibility:  parsed.scores.accessibility,
        scoreBestPractices:  parsed.scores.bestPractices,
        scoreSeo:            parsed.scores.seo,
        fcp: parsed.vitals.fcp,
        lcp: parsed.vitals.lcp,
        tbt: parsed.vitals.tbt,
        cls: parsed.vitals.cls,
        si:  parsed.vitals.si,
        tti: parsed.vitals.tti,
        reportPath,
        reportHtmlPath: htmlReportPath,
        durationMs: elapsed,
        completedAt: new Date(),
      })
      .where(eq(schema.auditRecords.id, recordId))

    return { recordId }

  } catch (err: unknown) {
    const elapsed = Math.round(performance.now() - start)

    await db.update(schema.auditRecords)
      .set({
        status: 'failed',
        errorMsg: err instanceof Error ? err.message : String(err),
        durationMs: elapsed,
        completedAt: new Date(),
      })
      .where(eq(schema.auditRecords.id, recordId))

    throw err
  }
}

/** 重新运行失败的任务 */
export async function retryAudit(recordId: string): Promise<{ recordId: string }> {
  const records = await db.select().from(schema.auditRecords).where(eq(schema.auditRecords.id, recordId))
  if (records.length === 0) throw new Error(`AuditRecord ${recordId} not found`)
  return runLighthouseAudit({ targetUrlId: records[0].targetUrlId })
}
