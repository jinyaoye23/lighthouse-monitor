/**
 * Lighthouse 程序化运行器
 *
 * 注意：lighthouse 返回的 LHR 包含 URL（`configSettings.emulatedFormFactor`、`finalDisplayedUrl` 等），
 * 但不会泄露任何凭据。JSON 报告保存到 data/reports/ 目录。
 */
import { db, schema } from '@/lib/db/client'
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ReportGenerator = (lighthouse as any).default ?? lighthouse

    const chrome = await chromeLauncher.launch({
      chromeFlags: [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        // 高强度反检测 (百度/阿里/腾讯等站点)
        '--disable-features=AutomationControlled',          // 移除 navigator.webdriver（新版 Chrome）
        '--disable-blink-features=AutomationControlled',     // 旧版 Chrome 兼容
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials',
        '--disable-web-security',
        '--disable-features=BlockInsecurePrivateNetworkRequests',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--disable-component-update',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-domain-reliability',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        `--user-agent=${target.device === 'mobile'
          ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}`,
      ],
    })

    // 注入反检测 JS 脚本（通过 CDP），在每一次页面导航前执行
    try {
      const cdp = await import('chrome-remote-interface')
      const client = await cdp.default({ port: chrome.port })
      const { Page } = client
      await Page.enable()
      await Page.addScriptToEvaluateOnNewDocument({
        source: `
// === Anti-detection script for headless Chrome ===
// 覆盖 navigator.webdriver（百度核心检测点）
Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

// 模拟真实 Chrome 的 plugins 数组（headless 下为空 → 暴露）
Object.defineProperty(navigator, 'plugins', {
  get: () => {
    const plugins = [1, 2, 3, 4, 5];
    plugins.item = i => plugins[i];
    plugins.namedItem = () => null;
    plugins.refresh = () => {};
    return plugins;
  }
});

// 模拟 languages
Object.defineProperty(navigator, 'languages', {
  get: () => ['zh-CN', 'zh', 'en-US', 'en']
});

// 模拟 chrome.runtime
window.chrome = window.chrome || {};
window.chrome.runtime = window.chrome.runtime || {};

// 绕过 permissions 检测
const originalQuery = window.navigator.permissions.query.bind(window.navigator.permissions);
window.navigator.permissions.query = (parameters) => {
  if (parameters.name === 'notifications') {
    return Promise.resolve({ state: Notification.permission, onchange: null });
  }
  return originalQuery(parameters);
};

// 模拟 platform 为 Windows
Object.defineProperty(navigator, 'platform', {
  get: () => 'Win32'
});

// 移除 "HeadlessChrome" 字样（如果存在）
Object.defineProperty(navigator, 'userAgent', {
  get: () => '${target.device === 'mobile'
    ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'}'
});

// 模拟 WebGL 指纹（headless 下通常返回不同的 vendor/renderer）
const getParameterProto = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(parameter) {
  if (parameter === 37445) return 'Google Inc. (Intel)';  // UNMASKED_VENDOR_WEBGL
  if (parameter === 37446) return 'ANGLE (Intel, Intel(R) UHD Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)';  // UNMASKED_RENDERER_WEBGL
  return getParameterProto.call(this, parameter);
};
WebGL2RenderingContext.prototype.getParameter = WebGLRenderingContext.prototype.getParameter;

// 模拟真实的 hardwareConcurrency（headless 有时为 1）
Object.defineProperty(navigator, 'hardwareConcurrency', {
  get: () => 8
});

// 模拟真实的 deviceMemory
Object.defineProperty(navigator, 'deviceMemory', {
  get: () => 8
});
` })
      await client.close()
    } catch (cdpErr) {
      console.warn('CDP stealth injection failed (non-fatal):', cdpErr)
    }

    const categories = JSON.parse(target.categories) as string[]
    // 根据设备类型选择 Lighthouse 预设，与 Chrome DevTools 完全一致
    const isMobile = target.device === 'mobile'

    const flags: Record<string, unknown> = {
      port: chrome.port,
      output: ['json', 'html'],
      locale: 'zh',
      onlyCategories: categories,
      // 关键：使用 simulate 模式匹配 Chrome DevTools Lighthouse 评分
      // simulate = 灯笼模拟（DevTools 默认）；devtools = 实际 CPU/网络节流（更悲观）
      throttlingMethod: 'simulate',
      throttling: isMobile
        ? {
            // 移动端：模拟 4x CPU 降速 + Slow 4G
            cpuSlowdownMultiplier: 4,
            downloadThroughputKbps: 1.6 * 1024,
            uploadThroughputKbps: 750,
            rttMs: 150,
            throughputKbps: 1.6 * 1024,
            requestLatencyMs: 150 * 3.75,
          }
        : {
            // 桌面端：模拟轻度节流（与 DevTools Desktop 预设一致）
            cpuSlowdownMultiplier: 1,
            downloadThroughputKbps: 0,
            uploadThroughputKbps: 0,
            rttMs: 40,
            throughputKbps: 10 * 1024,
            requestLatencyMs: 0,
          },
      formFactor: target.device,
      // 伪装真实浏览器请求头
      extraHeaders: {
        'User-Agent': isMobile
          ? 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      screenEmulation: {
        mobile: isMobile,
        width: isMobile ? 412 : 1350,
        height: isMobile ? 823 : 940,
        deviceScaleFactor: isMobile ? 2.625 : 1,
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
    const message = err instanceof Error ? err.message : String(err)

    // Log full error for debugging (Next.js production hides it behind a digest)
    console.error('[Lighthouse Audit Error]', message)
    if (err instanceof Error && err.stack) {
      console.error('[Lighthouse Audit Stack]', err.stack)
    }

    await db.update(schema.auditRecords)
      .set({
        status: 'failed',
        errorMsg: message,
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
