import { NextRequest, NextResponse } from 'next/server'
import { runLighthouseAudit } from '@/lib/lighthouse/runner'

/**
 * POST /api/audit
 * Body: { targetUrlId: string }
 * 触发 Lighthouse 检测并返回 recordId
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { targetUrlId?: string }
    if (!body?.targetUrlId) {
      return NextResponse.json({ error: 'targetUrlId is required' }, { status: 400 })
    }

    const { recordId } = await runLighthouseAudit({ targetUrlId: body.targetUrlId })

    return NextResponse.json({ recordId, status: 'completed' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
