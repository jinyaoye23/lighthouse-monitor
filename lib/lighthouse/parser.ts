import type { ParsedReport, Opportunity, Diagnostic } from '@/types'

/**
 * 从 Lighthouse 原始 JSON (LHR) 中提取结构化数据
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
    .map(id => ({
      id,
      title:        String(audits[id].title ?? id),
      description:  String(audits[id].description ?? ''),
      score:        typeof audits[id].score === 'number' ? Math.round(audits[id].score as number * 100) : null,
      numericValue: typeof audits[id].numericValue === 'number' ? Math.round(audits[id].numericValue as number * 100) / 100 : null,
    }))
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
    .map(id => ({
      id,
      title:        String(audits[id].title ?? id),
      description:  String(audits[id].description ?? ''),
      displayValue: typeof audits[id].displayValue === 'string' ? audits[id].displayValue as string : null,
    }))
}
