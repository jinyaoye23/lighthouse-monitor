import { NextRequest, NextResponse } from 'next/server'
import { getAuditRecord } from '@/lib/actions/audits'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/report/[recordId]/json
 * 返回 Lighthouse JSON 报告文件下载
 *
 * 安全限制：
 * - 只允许访问 data/reports/ 下的 .json 文件
 * - reportPath 必须存在于 DB 记录中
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> }
) {
  const { recordId } = await params

  // 1. 从 DB 获取记录（验证记录存在、状态为 completed）
  const record = await getAuditRecord(recordId)
  if (!record || !record.reportPath) {
    return new NextResponse('报告不存在', { status: 404 })
  }

  // 2. 路径安全校验：只允许 data/reports/ 下、以 .json 结尾的文件
  const reportsDir = path.resolve(process.cwd(), 'data', 'reports')
  const resolvedPath = path.resolve(record.reportPath)

  if (!resolvedPath.startsWith(reportsDir) || !resolvedPath.endsWith('.json')) {
    return new NextResponse('无效的报告路径', { status: 403 })
  }

  // 3. 读取文件
  if (!fs.existsSync(resolvedPath)) {
    return new NextResponse('报告文件不存在', { status: 404 })
  }

  const json = fs.readFileSync(resolvedPath, 'utf-8')

  return new NextResponse(json, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="lighthouse-report-${recordId}.json"`,
    },
  })
}
