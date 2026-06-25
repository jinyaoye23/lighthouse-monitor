import type { ParsedReport, Opportunity, Diagnostic } from '@/types'

// ── 中文映射表：Lighthouse audit ID → { title, description } ──
const AUDIT_ZH: Record<string, { title: string; description: string }> = {
  'first-contentful-paint':           { title: '首次内容渲染 (FCP)',       description: '浏览器首次渲染任何文本、图片、非白色 Canvas 或 SVG 的时间点' },
  'largest-contentful-paint':         { title: '最大内容渲染 (LCP)',       description: '视口内最大可见内容元素完成渲染的时间点' },
  'total-blocking-time':              { title: '总阻塞时间 (TBT)',         description: 'FCP 与 TTI 之间，主线程被长任务阻塞的总时长' },
  'cumulative-layout-shift':          { title: '累计布局偏移 (CLS)',       description: '页面生命周期内所有意外布局偏移的累计分数' },
  'speed-index':                      { title: '速度指数 (SI)',            description: '页面内容可见填充的速度指标' },
  'interactive':                      { title: '可交互时间 (TTI)',         description: '页面完全可交互所需的时间' },
  'render-blocking-resources':        { title: '减少阻塞渲染的资源',       description: '移除或延迟加载阻塞首次渲染的 CSS/JS 资源' },
  'uses-responsive-images':           { title: '使用响应式图片',            description: '根据设备尺寸提供适当大小的图片，避免移动端加载过大图片' },
  'offscreen-images':                 { title: '延迟加载屏幕外图片',       description: '对首屏不可见的图片使用懒加载，减少初始网络请求' },
  'unminified-css':                   { title: '压缩 CSS 文件',            description: '移除 CSS 中的空白和注释以减小文件体积' },
  'unminified-javascript':            { title: '压缩 JavaScript 文件',     description: '移除 JS 中的空白和注释以减小文件体积' },
  'unused-css-rules':                 { title: '移除未使用的 CSS',         description: '删除页面未引用的 CSS 规则以减少样式表体积' },
  'unused-javascript':                { title: '减少未使用的 JavaScript',  description: '移除或延迟加载未在当前页面使用的 JS 代码' },
  'uses-optimized-images':            { title: '优化图片资源',             description: '使用高效编码和适当尺寸的图片以减小传输体积' },
  'modern-image-formats':             { title: '使用现代图片格式',         description: '使用 WebP 或 AVIF 等现代格式替代 JPEG/PNG 以获得更好的压缩率' },
  'uses-text-compression':            { title: '启用文本压缩',             description: '对文本资源启用 Gzip 或 Brotli 压缩以减小传输大小' },
  'uses-rel-preconnect':              { title: '预连接关键来源',           description: '对关键第三方域名建立早期连接以减少延迟' },
  'server-response-time':             { title: '缩短服务器响应时间',       description: '优化后端性能，确保服务器在 600ms 内返回主文档' },
  'redirects':                        { title: '避免多次重定向',           description: '减少页面加载过程中的重定向跳转次数' },
  'uses-rel-preload':                 { title: '预加载关键请求',           description: '使用 &lt;link rel=preload&gt; 优先加载关键资源' },
  'efficient-animated-content':       { title: '使用高效的动画格式',       description: '用视频或 CSS 动画替代 GIF 以减小文件体积' },
  'total-byte-weight':                { title: '减少网络负载',             description: '控制页面总资源大小，避免传输过多数据' },
  'dom-size':                         { title: '避免过大的 DOM 树',        description: '过多的 DOM 节点会增加样式计算和布局重排的时间' },
  'third-party-summary':              { title: '减少第三方代码影响',       description: '第三方脚本可能显著影响加载性能' },
  'mainthread-work-breakdown':        { title: '主线程任务分解',           description: '分析主线程中各阶段任务耗时分布' },
  'bootup-time':                      { title: 'JavaScript 启动耗时',      description: 'JS 脚本的解析、编译和执行总耗时' },
  'network-rtt':                      { title: '网络往返时间 (RTT)',       description: '各来源域名的网络往返时间' },
  'network-server-latency':           { title: '服务器延迟',               description: '服务器响应请求的时间' },
  'font-display':                     { title: '字体显示策略',             description: '确保自定义字体加载期间文字仍然可见' },
  'critical-request-chains':          { title: '关键请求链',               description: '加载页面关键资源所需的请求依赖链' },
  'uses-long-cache-ttl':              { title: '使用高效缓存策略',         description: '对静态资源设置足够的缓存过期时间' },
  'largest-contentful-paint-element': { title: 'LCP 元素',                 description: '被识别为 LCP 最大内容渲染的元素' },
  'layout-shift-elements':            { title: '布局偏移元素',             description: '引发 CLS 累计布局偏移的 DOM 元素' },
  'long-tasks':                       { title: '长任务',                   description: '耗时超过 50ms 的主线程任务' },
}

function zh(id: string, raw: Record<string, unknown>): { title: string; description: string } {
  const mapped = AUDIT_ZH[id]
  return {
    title: mapped?.title ?? String(raw.title ?? id),
    description: mapped?.description ?? String(raw.description ?? ''),
  }
}

/**
 * 从 Lighthouse 原始 JSON (LHR) 中提取结构化数据（中文）
 */
export function parseLhr(lhr: Record<string, unknown>): ParsedReport {
  const categories = lhr.categories as Record<string, Record<string, unknown>> | undefined
  const audits    = lhr.audits    as Record<string, Record<string, unknown>> | undefined

  // ── Scores ──
  const scores = {
    performance:    categories?.performance?.score    != null ? Math.round((categories.performance.score as number) * 100) : null,
    accessibility:  categories?.accessibility?.score  != null ? Math.round((categories.accessibility.score as number) * 100) : null,
    bestPractices:  categories?.['best-practices']?.score != null ? Math.round((categories['best-practices'].score as number) * 100) : null,
    seo:            categories?.seo?.score            != null ? Math.round((categories.seo.score as number) * 100) : null,
  }

  // ── Web Vitals ──
  const vitals = {
    fcp: numericMs(audits?.['first-contentful-paint']),
    lcp: numericMs(audits?.['largest-contentful-paint']),
    tbt: numericMs(audits?.['total-blocking-time']),
    cls: numeric(audits?.['cumulative-layout-shift']),
    si:  numericMs(audits?.['speed-index']),
    tti: numericMs(audits?.['interactive']),
  }

  // ── Opportunities ──
  const opportunities = extractOpportunities(audits)

  // ── Diagnostics ──
  const diagnostics = extractDiagnostics(audits)

  return { scores, vitals, opportunities, diagnostics, rawLhr: lhr }
}

// ── helpers ──

function numericMs(audit: Record<string, unknown> | undefined): number | null {
  if (!audit) return null
  const v = audit.numericValue
  if (typeof v !== 'number') return null
  return Math.round(v * 100) / 100
}

function numeric(audit: Record<string, unknown> | undefined): number | null {
  if (!audit) return null
  const v = audit.numericValue
  if (typeof v !== 'number') return null
  // keep raw; CLS is unitless
  return Math.round(v * 10_000) / 10_000
}

const OPPORTUNITY_IDS = [
  'render-blocking-resources',
  'uses-responsive-images',
  'offscreen-images',
  'unminified-css',
  'unminified-javascript',
  'unused-css-rules',
  'unused-javascript',
  'uses-optimized-images',
  'modern-image-formats',
  'uses-text-compression',
  'uses-rel-preconnect',
  'server-response-time',
  'redirects',
  'uses-rel-preload',
  'efficient-animated-content',
  'total-byte-weight',
  'dom-size',
  'third-party-summary',
]

function extractOpportunities(audits: Record<string, Record<string, unknown>> | undefined): Opportunity[] {
  if (!audits) return []
  return OPPORTUNITY_IDS
    .filter(id => audits[id] && audits[id].details)
    .map(id => {
      const z = zh(id, audits[id])
      return {
        id,
        title:        z.title,
        description:  z.description,
        score:        typeof audits[id].score === 'number' ? Math.round(audits[id].score as number * 100) : null,
        numericValue: typeof audits[id].numericValue === 'number' ? Math.round(audits[id].numericValue as number * 100) / 100 : null,
      }
    })
    .sort((a, b) => (a.numericValue ?? Infinity) - (b.numericValue ?? Infinity))
}

const DIAGNOSTIC_IDS = [
  'mainthread-work-breakdown',
  'bootup-time',
  'network-rtt',
  'network-server-latency',
  'font-display',
  'total-byte-weight',
  'dom-size',
  'critical-request-chains',
  'third-party-summary',
  'uses-long-cache-ttl',
  'largest-contentful-paint-element',
  'layout-shift-elements',
  'long-tasks',
]

function extractDiagnostics(audits: Record<string, Record<string, unknown>> | undefined): Diagnostic[] {
  if (!audits) return []
  return DIAGNOSTIC_IDS
    .filter(id => audits[id])
    .map(id => {
      const z = zh(id, audits[id])
      return {
        id,
        title:        z.title,
        description:  z.description,
        displayValue: typeof audits[id].displayValue === 'string' ? audits[id].displayValue as string : null,
      }
    })
}
