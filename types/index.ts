export interface Project {
  id: string
  name: string
  description: string | null
  color: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ProjectWithStats extends Project {
  urlCount: number
  lastAuditAt: Date | null
  avgScore: number | null
}

export interface TargetUrl {
  id: string
  projectId: string
  url: string
  alias: string | null
  device: 'mobile' | 'desktop'
  categories: string
  timeoutSecs: number
  createdAt: Date
  updatedAt: Date
}

export type AuditStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AuditRecord {
  id: string
  targetUrlId: string
  status: AuditStatus
  scorePerformance: number | null
  scoreAccessibility: number | null
  scoreBestPractices: number | null
  scoreSeo: number | null
  fcp: number | null
  lcp: number | null
  tbt: number | null
  cls: number | null
  si: number | null
  tti: number | null
  reportPath: string | null
  errorMsg: string | null
  durationMs: number | null
  createdAt: Date
  completedAt: Date | null
}

export interface AuditDetail extends AuditRecord {
  targetUrl: TargetUrl
  project: Project
}

export interface TrendPoint {
  date: string
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}

export interface PaginationOpts {
  page?: number
  pageSize?: number
  startDate?: Date
  endDate?: Date
}

export interface AuditRecordPage {
  records: AuditRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ParsedReport {
  scores: {
    performance: number | null
    accessibility: number | null
    bestPractices: number | null
    seo: number | null
  }
  vitals: {
    fcp: number | null
    lcp: number | null
    tbt: number | null
    cls: number | null
    si: number | null
    tti: number | null
  }
  opportunities: Opportunity[]
  diagnostics: Diagnostic[]
  rawLhr: unknown
}

export interface Opportunity {
  id: string
  title: string
  description: string
  score: number | null
  numericValue: number | null
}

export interface Diagnostic {
  id: string
  title: string
  description: string
  displayValue: string | null
}
