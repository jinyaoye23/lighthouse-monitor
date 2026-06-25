import { NextRequest, NextResponse } from 'next/server'
import { getAuditRecord } from '@/lib/actions/audits'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/report/[recordId]
 * 返回 Lighthouse 原始 HTML 报告
 * 
 * 安全限制：
 * - 只允许访问 data/reports/ 下的 .html 文件
 * - reportHtmlPath 必须已存在于 DB 记录中
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params

  // 1. 从 DB 获取记录（验证记录存在、状态为 completed）
  const record = await getAuditRecord(recordId)
  if (!record || !record.reportHtmlPath) {
    return new NextResponse('报告不存在', { status: 404 })
  }

  // 2. 路径安全校验：只允许 data/reports/ 下、以 .html 结尾的文件
  const reportsDir = path.resolve(process.cwd(), 'data', 'reports')
  const resolvedPath = path.resolve(record.reportHtmlPath)

  if (!resolvedPath.startsWith(reportsDir) || !resolvedPath.endsWith('.html')) {
    return new NextResponse('无效的报告路径', { status: 403 })
  }

  // 3. 读取文件
  if (!fs.existsSync(resolvedPath)) {
    return new NextResponse('报告文件不存在', { status: 404 })
  }

  const html = fs.readFileSync(resolvedPath, 'utf-8')

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=604800, immutable', // 缓存 7 天
    },
  })
}
