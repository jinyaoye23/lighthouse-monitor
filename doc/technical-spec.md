# Lighthouse Monitor — 技术细节文档

> 代码级技术规格，涵盖数据库、API、组件、算法、配置的完整细节。
> 定位：开发参考手册，面向后续接手维护或功能扩展的开发者。

---

## 目录

1. [数据库 Schema 详解](#1-数据库-schema-详解)
2. [API 路由契约](#2-api-路由契约)
3. [Server Actions 签名与数据流](#3-server-actions-签名与数据流)
4. [Lighthouse Runner 内部机制](#4-lighthouse-runner-内部机制)
5. [结果解析器 (Parser)](#5-结果解析器-parser)
6. [组件树与数据流](#6-组件树与数据流)
7. [关键配置项](#7-关键配置项)
8. [类型系统](#8-类型系统)
9. [Docker 构建管道](#9-docker-构建管道)
10. [CI/CD 部署管道](#10-cicd-部署管道)
11. [安全模型](#11-安全模型)
12. [目录结构全览](#12-目录结构全览)

---

## 1. 数据库 Schema 详解

### 1.1 表结构与 DDL

**引擎**: SQLite (libSQL) | **模式**: WAL | **ORM**: Drizzle

#### projects（项目表）

```sql
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,       -- nanoid(12)，例: 'a1B2c3D4e5F6'
  name        TEXT NOT NULL,          -- 项目名称
  description TEXT,                   -- 项目描述，可为空
  color       TEXT DEFAULT '#6366f1', -- Tailwind CSS 色值
  created_at  INTEGER NOT NULL,       -- Unix 毫秒时间戳
  updated_at  INTEGER NOT NULL        -- Unix 毫秒时间戳
);
```

#### target_urls（检测目标 URL 表）

```sql
CREATE TABLE IF NOT EXISTS target_urls (
  id           TEXT PRIMARY KEY,       -- nanoid(12)
  project_id   TEXT NOT NULL           -- FK → projects.id, ON DELETE CASCADE
                REFERENCES projects(id) ON DELETE CASCADE,
  url          TEXT NOT NULL,          -- 完整 URL，如 'https://example.com'
  alias        TEXT,                   -- 显示别名，如 '首页'
  device       TEXT DEFAULT 'mobile',  -- 'mobile' | 'desktop'
  categories   TEXT NOT NULL           -- JSON 数组字符串
                DEFAULT '["performance","accessibility","best-practices","seo"]',
  timeout_secs INTEGER DEFAULT 60,     -- Lighthouse 超时秒数
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_target_urls_project_id ON target_urls(project_id);
```

#### audit_records（检测记录表）

```sql
CREATE TABLE IF NOT EXISTS audit_records (
  id                   TEXT PRIMARY KEY,     -- nanoid(12)
  target_url_id        TEXT NOT NULL
                        REFERENCES target_urls(id) ON DELETE CASCADE,
  status               TEXT DEFAULT 'pending', -- pending→running→completed|failed
  score_performance    REAL,   -- 0-100，NULL 表示未完成
  score_accessibility  REAL,
  score_best_practices REAL,
  score_seo            REAL,
  fcp   REAL,   -- First Contentful Paint (ms)
  lcp   REAL,   -- Largest Contentful Paint (ms)
  tbt   REAL,   -- Total Blocking Time (ms)
  cls   REAL,   -- Cumulative Layout Shift (无单位比值)
  si    REAL,   -- Speed Index (ms)
  tti   REAL,   -- Time to Interactive (ms)
  report_path      TEXT,   -- JSON 报告路径: 'data/reports/{id}.json'
  report_html_path TEXT,   -- HTML 报告路径: 'data/reports/{id}.html'
  error_msg        TEXT,   -- 失败时的错误信息
  duration_ms      INTEGER,-- 检测耗时（毫秒）
  created_at       INTEGER NOT NULL,
  completed_at     INTEGER  -- 完成时间戳
);

CREATE INDEX IF NOT EXISTS idx_audit_records_target_url_id ON audit_records(target_url_id);
CREATE INDEX IF NOT EXISTS idx_audit_records_created_at ON audit_records(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_records_status ON audit_records(status);
```

### 1.2 级联删除链路

```
projects ──CASCADE──▶ target_urls ──CASCADE──▶ audit_records
                                                      │
                                           data/reports/{id}.json
                                           data/reports/{id}.html
```

删除项目时 DB 自动级联删除 URL 和记录，但**报告文件需应用层清理**（`deleteAuditRecord` 中有 `fs.unlink`）。

### 1.3 数据库客户端初始化（Proxy 延迟加载）

```typescript
// lib/db/client.ts
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

let dbInstance: ReturnType<typeof drizzle> | null = null

function getDb() {
  if (dbInstance) return dbInstance
  const dataDir = process.env.DATA_DIR || './data'
  const dbPath = `${dataDir}/lighthouse.db`
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
  dbInstance = drizzle({
    connection: { url: `file:${dbPath}` },
    schema,
  })
  return dbInstance
}

// 用 Proxy 拦截：编译期不触发 fs/native 模块
export const db: typeof dbInstance = new Proxy({} as any, {
  get(_, prop) {
    const real = getDb()
    return (real as any)[prop]
  },
})
```

**为什么用 Proxy**: Next.js 编译阶段会 import 所有模块。直接在模块顶层 `drizzle(...)` 会触发 `better-sqlite3` 的原生模块加载，导致 `MODULE_NOT_FOUND`。Proxy 将初始化推迟到首次运行时调用。

### 1.4 Docker 容器启动时的幂等建表

```javascript
// scripts/init-db.mjs
import Database from 'better-sqlite3'
import fs from 'fs'

const dataDir = process.env.DATA_DIR || '/app/data'
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const db = new Database(`${dataDir}/lighthouse.db`)
db.pragma('journal_mode = WAL')
db.exec(`CREATE TABLE IF NOT EXISTS projects (...)`)
db.exec(`CREATE TABLE IF NOT EXISTS target_urls (...)`)
db.exec(`CREATE TABLE IF NOT EXISTS audit_records (...)`)
// ... 创建索引
db.close()
```

`IF NOT EXISTS` 保证多次执行安全。在 Docker `CMD` 中 `server.js` 之前执行。

---

## 2. API 路由契约

### 2.1 POST `/api/audit`

**功能**: 触发 Lighthouse 检测

```
Method:  POST
Path:    /api/audit
Body:    JSON — { targetUrlId: string }
```

**正常响应** (200):
```json
{
  "recordId": "a1B2c3D4e5F6",
  "status": "completed"
}
```

**错误响应**:
```json
// 400 — 缺少 targetUrlId
{ "error": "targetUrlId is required" }

// 404 — URL 不存在
{ "error": "Target URL not found" }

// 500 — 检测执行失败
{ "error": "Lighthouse audit failed: <details>" }
```

### 2.2 GET `/api/report/[recordId]`

**功能**: 返回 Lighthouse HTML 报告

```
Method:  GET
Path:    /api/report/[recordId]
Headers: Content-Type: text/html; charset=utf-8
         Cache-Control: public, max-age=604800, immutable
```

**安全校验逻辑**:
```typescript
// 1. DB 查询 record.reportHtmlPath 是否存在
const record = await db.query.audit_records.findFirst({
  where: eq(audit_records.id, recordId),
})

// 2. 路径必须在 data/reports/ 目录下
const safePath = path.resolve(record.reportHtmlPath)
if (!safePath.startsWith(path.resolve('data/reports/'))) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// 3. 只允许 .html 扩展名
if (!safePath.endsWith('.html')) {
  return NextResponse.json({ error: 'Invalid file type' }, { status: 403 })
}
```

### 2.3 GET `/api/report/[recordId]/json`

**功能**: 下载 Lighthouse JSON 报告

```
Method:  GET
Path:    /api/report/[recordId]/json
Headers: Content-Type: application/json; charset=utf-8
         Content-Disposition: attachment; filename="lighthouse-report-{recordId}.json"
```

安全校验同上，但检查 `.json` 扩展名。

---

## 3. Server Actions 签名与数据流

### 3.1 项目操作 (`lib/actions/projects.ts`)

```typescript
// 创建
createProject(data: {
  name: string
  description?: string
  color?: string
}): Promise<Project>

// 列表（含统计）
getProjects(): Promise<ProjectWithStats[]>

// 详情
getProject(id: string): Promise<Project | null>

// 更新
updateProject(id: string, data: {
  name?: string
  description?: string
  color?: string
}): Promise<Project>

// 删除（级联）
deleteProject(id: string): Promise<void>
```

**`ProjectWithStats` 的计算**（每次查询实时聚合）:

```typescript
// 伪代码：一次 JOIN + 子查询完成
SELECT
  p.*,
  COUNT(tu.id) as urlCount,
  MAX(ar.created_at) as lastAuditAt,
  AVG(ar.score_performance) as avgScore
FROM projects p
LEFT JOIN target_urls tu ON tu.project_id = p.id
LEFT JOIN audit_records ar ON ar.target_url_id = tu.id
GROUP BY p.id
```

### 3.2 URL 操作 (`lib/actions/urls.ts`)

```typescript
createTargetUrl(data: {
  projectId: string
  url: string
  alias?: string
  device?: 'mobile' | 'desktop'
  categories?: string[]         // 存为 JSON 字符串
  timeoutSecs?: number
}): Promise<TargetUrl>

getTargetUrls(projectId: string): Promise<TargetUrl[]>
getTargetUrl(id: string): Promise<TargetUrl | null>

updateTargetUrl(id: string, data: { /* 同上，全部可选 */ }): Promise<TargetUrl>
deleteTargetUrl(id: string): Promise<void>
```

### 3.3 检测记录操作 (`lib/actions/audits.ts`)

```typescript
// 分页查询
getAuditRecords(targetUrlId: string, opts?: {
  page?: number       // 默认 1
  pageSize?: number   // 默认 20
  startDate?: Date    // 时间范围过滤
  endDate?: Date
}): Promise<{
  records: AuditRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}>

// 单条 / 详情
getAuditRecord(id: string): Promise<AuditRecord | null>
getAuditDetail(id: string): Promise<AuditDetail | null>

// 趋势数据（用于 Recharts 图表）
getScoreTrend(targetUrlId: string, limit?: number): Promise<{
  date: string            // 'YYYY-MM-DD'
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}[]>

// 触发检测 — 关键：结构化返回
triggerAudit(targetUrlId: string):
  Promise<{ ok: true; recordId: string } | { ok: false; error: string }>

// 删除
deleteAuditRecord(id: string): Promise<void>
```

### 3.4 `triggerAudit` 的完整执行序列

```
triggerAudit(targetUrlId)
│
├─ 1. db.query.target_urls → 获取 URL 信息
│
├─ 2. db.insert(audit_records) → 创建 pending 记录
│
├─ 3. db.update(audit_records) → status = 'running'
│
├─ 4. runLighthouseAudit({ recordId, targetUrlId })  ← 进入 runner
│      │                                               ↓ 见第 4 节
│      └─ ✅ recordId (成功) / ❌ throw (失败)
│
├─ 5. db.update(audit_records) → status='completed', scores, vitals
│
└─ return { ok: true, recordId }
   或 catch → return { ok: false, error: e.message }
```

---

## 4. Lighthouse Runner 内部机制

### 4.1 核心函数签名

```typescript
// lib/lighthouse/runner.ts

interface RunOptions {
  recordId: string      // 预创建的 audit_record ID
  targetUrlId: string
}

interface LighthouseResult {
  lhr: any              // Lighthouse Result 原始对象
  report: string[]      // [0]=JSON 字符串, [1]=HTML 字符串
  artifacts: any
}

export async function runLighthouseAudit(opts: RunOptions): Promise<{
  recordId: string
}>
```

### 4.2 执行流程图

```
runLighthouseAudit(opts)
│
├─ [Stage 1] 数据库查询
│   └─ targetUrl = db.query.target_urls.findOne({ id: opts.targetUrlId })
│       └─ 404 → throw 'Target URL not found'
│
├─ [Stage 2] 更新状态为 running
│   └─ db.update(audit_records).set({ status: 'running' })
│
├─ [Stage 3] 动态 import（避免编译期 ESM 冲突）
│   └─ const lighthouse = await import('lighthouse')
│   └─ const chromeLauncher = await import('chrome-launcher')
│
├─ [Stage 4] 启动 Chrome headless
│   │
│   ├─ chromeLauncher.launch({
│   │     chromeFlags: [
│   │       '--headless=new',
│   │       '--no-sandbox',
│   │       '--no-first-run',
│   │       '--no-default-browser-check',
│   │     ]
│   │   })
│   │
│   │   Chrome 实体: google-chrome-stable
│   │   port: 动态分配（chrome-launcher 自动选择可用端口）
│   │
│   └─ 返回 chrome 实例 { port, pid, kill() }
│
├─ [Stage 5] 配置 Lighthouse Flags
│   │
│   │  Desktop 模式:
│   │  {
│   │    output: ['json', 'html'],
│   │    locale: 'zh',
│   │    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
│   │    throttlingMethod: 'provided',
│   │    formFactor: 'desktop',
│   │    screenEmulation: {
│   │      mobile: false,
│   │      width: 1440,
│   │      height: 900,
│   │      deviceScaleFactor: 1,
│   │      disabled: false
│   │    },
│   │    port: chrome.port
│   │  }
│   │
│   │  Mobile 模式:
│   │  {
│   │    ...同上,
│   │    throttlingMethod: 'provided',  // 见 4.4 节说明
│   │    formFactor: 'mobile',
│   │    screenEmulation: {
│   │      mobile: true,
│   │      width: 412,
│   │      height: 823,
│   │      deviceScaleFactor: 2.625,
│   │      disabled: false
│   │    }
│   │  }
│
├─ [Stage 6] 运行 Lighthouse
│   │
│   │  result = await lighthouse(targetUrl.url, flags)
│   │
│   │  内部流程:
│   │  1. 打开浏览器标签页 → 导航到 targetUrl.url
│   │  2. 执行一系列 "Gatherers"（收集页面数据）
│   │  3. 运行 "Audits"（对数据打分）
│   │  4. 返回 { lhr, report, artifacts }
│   │
│   │  lhr (Lighthouse Result) 核心结构:
│   │  {
│   │    categories: {
│   │      performance: { id, title, score },
│   │      accessibility: { id, title, score },
│   │      'best-practices': { id, title, score },
│   │      seo: { id, title, score }
│   │    },
│   │    audits: {
│   │      'first-contentful-paint': { id, title, numericValue, displayValue },
│   │      'largest-contentful-paint': { ... },
│   │      'total-blocking-time': { ... },
│   │      // ... 100+ 个审计项
│   │    }
│   │  }
│
├─ [Stage 7] 解析结果 → parseLhr(lhr)
│   │          ↓ 见第 5 节
│   └─ parsed = { scores, vitals, opportunities, diagnostics }
│
├─ [Stage 8] 保存报告文件
│   │
│   │  data/reports/{recordId}.json  ← result.report[0]
│   │  data/reports/{recordId}.html  ← result.report[1]
│   │
│   └─ fs.writeFileSync(...)
│
├─ [Stage 9] 更新数据库
│   │
│   │  db.update(audit_records).set({
│   │    status: 'completed',
│   │    score_performance: parsed.scores.performance,
│   │    score_accessibility: parsed.scores.accessibility,
│   │    score_best_practices: parsed.scores.bestPractices,
│   │    score_seo: parsed.scores.seo,
│   │    fcp: parsed.vitals.fcp,
│   │    lcp: parsed.vitals.lcp,
│   │    tbt: parsed.vitals.tbt,
│   │    cls: parsed.vitals.cls,
│   │    si: parsed.vitals.si,
│   │    tti: parsed.vitals.tti,
│   │    report_path: 'data/reports/{recordId}.json',
│   │    report_html_path: 'data/reports/{recordId}.html',
│   │    duration_ms: Date.now() - startTime,
│   │    completed_at: Date.now()
│   │  })
│
├─ [Stage 10] 关闭 Chrome
│   └─ chrome.kill()
│
└─ return { recordId }

// 异常路径
catch (error) {
  db.update(audit_records).set({
    status: 'failed',
    error_msg: String(error),
    completed_at: Date.now()
  })
  throw error  // 抛出给 triggerAudit 的 try-catch
}
```

### 4.3 动态 import 机制

```typescript
// Lighthouse 和 chrome-launcher 是 ESM-only 包
// Next.js 编译阶段用 CommonJS 方式 import 会报错
// 因此必须在运行时动态加载：

let lighthouse, chromeLauncher
try {
  lighthouse = (await import('lighthouse')).default
  chromeLauncher = (await import('chrome-launcher')).default
} catch (err) {
  throw new Error(`Failed to import lighthouse modules: ${err}`)
}
```

### 4.4 `throttlingMethod` 变更历史与当前策略

| 版本 | 模式 | 效果 | 适用场景 |
|------|------|------|---------|
| v0.1 | `devtools` | 真实 CPU/网络节流 | 本地开发（准确但慢） |
| v0.2 | `simulate` | 数学模拟节流 | 对标 Chrome DevTools（需要 4核8G+） |
| **当前** | **`provided`** | 如实报告，不做模拟 | 2核2G 服务器（稳定可靠） |

**`provided` 模式原理**:
- Lighthouse 不附加任何 CPU/网络限制
- 不模拟慢速连接
- 报告的是服务器实际环境下的页面加载性能
- 分数在不同站点之间具有可比性（同一硬件环境）
- 分数不可直接对标本地 DevTools（硬件差异）

---

## 5. 结果解析器 (Parser)

### 5.1 核心函数

```typescript
// lib/lighthouse/parser.ts

interface ParsedReport {
  scores: {
    performance: number | null       // 0-100
    accessibility: number | null
    bestPractices: number | null
    seo: number | null
  }
  vitals: {
    fcp: number | null  // ms
    lcp: number | null  // ms
    tbt: number | null  // ms
    cls: number | null  // 无量纲
    si: number | null   // ms
    tti: number | null  // ms
  }
  opportunities: Array<{
    id: string
    title: string            // 中文标题
    description: string      // 中文描述
    score: number | null
    numericValue: number | null  // 节省的 ms 或 KB
    displayValue: string | null
  }>
  diagnostics: Array<{
    id: string
    title: string
    description: string
    displayValue: string | null
  }>
}

export function parseLhr(lhr: Record<string, unknown>): ParsedReport
```

### 5.2 评分提取算法

```typescript
// 从 LHR 的 categories 中提取评分
// 原始 score 为 0-1，乘以 100 转为百分比
function extractScore(lhr: any, categoryId: string): number | null {
  const category = lhr.categories?.[categoryId]
  if (!category?.score && category?.score !== 0) return null
  return Math.round(category.score * 100)
}

// 调用
scores = {
  performance:    extractScore(lhr, 'performance'),
  accessibility:  extractScore(lhr, 'accessibility'),
  bestPractices:  extractScore(lhr, 'best-practices'),
  seo:            extractScore(lhr, 'seo'),
}
```

### 5.3 Web Vitals 提取

```typescript
// 从 LHR 的 audits 中提取各 Core Web Vital
// 每个 audit 的 numericValue 是毫秒（CLS 例外，是无单位比值）

const vitalsMap = {
  fcp: 'first-contentful-paint',
  lcp: 'largest-contentful-paint',
  tbt: 'total-blocking-time',
  cls: 'cumulative-layout-shift',
  si:  'speed-index',
  tti: 'interactive',
}

for (const [key, auditId] of Object.entries(vitalsMap)) {
  const audit = lhr.audits?.[auditId]
  vitals[key] = audit?.numericValue ?? null
}
```

### 5.4 优化建议 (Opportunities) 与诊断信息 (Diagnostics) 提取

```typescript
// Opportunities: score < 1 的审计项（有改进空间）
const opportunities = []
for (const [id, audit] of Object.entries(lhr.audits)) {
  if (audit.details?.type === 'opportunity' && audit.score < 1) {
    opportunities.push({
      id,
      title: ZH_MAP[id]?.title || audit.title,
      description: ZH_MAP[id]?.description || audit.description,
      score: audit.score !== undefined ? Math.round(audit.score * 100) : null,
      numericValue: audit.numericValue ?? null,
      displayValue: audit.displayValue ?? null,
    })
  }
}

// Diagnostics: score === 1 但仍有信息的审计项（已通过但有附加数据）
const diagnostics = []
for (const [id, audit] of Object.entries(lhr.audits)) {
  if (audit.score === 1 && audit.displayValue) {
    diagnostics.push({
      id,
      title: ZH_MAP[id]?.title || audit.title,
      description: ZH_MAP[id]?.description || audit.description,
      displayValue: audit.displayValue ?? null,
    })
  }
}
```

### 5.5 中文化映射表 (ZH_MAP)

```typescript
// 30+ 个常用 audit ID 的中文映射
// 键 = Lighthouse audit ID，值 = { title, description }

const ZH_MAP: Record<string, { title: string; description: string }> = {
  'render-blocking-resources': {
    title: '消除渲染阻塞资源',
    description: '部分资源阻塞了页面的首次绘制。考虑以内联方式交付关键 JS/CSS，并将其余部分延迟加载。',
  },
  'unused-css-rules': {
    title: '移除未使用的 CSS',
    description: '移除样式表中未使用的规则，减少网络活动消耗的字节数。',
  },
  'unminified-css': {
    title: '压缩 CSS',
    description: '压缩 CSS 文件可缩减网络负载大小。',
  },
  // ... 另有 27 个条目覆盖 image-aspect-ratio、offscreen-images、
  //     uses-responsive-images、total-byte-weight 等常见审计项
}
```

---

## 6. 组件树与数据流

### 6.1 布局层

```
app/layout.tsx (RootLayout)
├─ <html lang="zh-CN">
├─ <body className="min-h-screen bg-gray-50 dark:bg-gray-950">
│  ├─ <Sidebar />                  ← 客户端组件（hamburger + overlay）
│  │   ├─ 项目列表 Link → /projects
│  │   └─ 检测记录 Link → /audits
│  ├─ <main className="lg:pl-64">  ← 桌面端左侧留出 sidebar 宽度
│  │   └─ {children}               ← 页面内容
│  └─ <ToasterProvider />           ← Sonner toast
```

### 6.2 页面路由与数据获取方式

| 路由 | 数据获取 | 渲染模式 |
|------|---------|---------|
| `/projects` | Server Component 直接调用 `getProjects()` | SSR（`force-dynamic`） |
| `/projects/new` | 纯客户端表单 | CSR（通过 `createProject` action） |
| `/projects/[id]` | `getProject()` + `getTargetUrls()` | SSR（`force-dynamic`） |
| `/projects/[id]/edit` | `getProject()` → 预填表单 | SSR |
| `/projects/[id]/urls/[urlId]` | `getTargetUrl()` + `getAuditRecords()` + `getScoreTrend()` | SSR（`force-dynamic`） |
| `/projects/[id]/urls/[urlId]/records/[recordId]` | `getAuditDetail()` + `getScoreTrend()` | SSR |
| `/audits` | 全量 `getAuditRecords()` | SSR |

### 6.3 客户端交互组件

#### Sidebar (`components/layout/Sidebar.tsx`)

```typescript
// 响应式导航：桌面端始终可见，移动端 hamburger toggle + overlay
'use client'

export function Sidebar() {
  const [open, setOpen] = useState(false)
  // 桌面端: lg:translate-x-0（始终可见）
  // 移动端: open ? translate-x-0 : -translate-x-full
  return (
    <>
      {/* Hamburger 按钮（移动端） */}
      <button onClick={() => setOpen(!open)} className="lg:hidden">
        <Menu />
      </button>

      {/* Overlay（移动端打开时） */}
      {open && <div onClick={() => setOpen(false)} className="lg:hidden fixed inset-0 bg-black/50 z-40" />}

      {/* 侧边栏 */}
      <aside className={cn('fixed ... lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <nav>
          <NavLink href="/projects" icon={Folders} label="项目列表" />
          <NavLink href="/audits" icon={BarChart3} label="检测记录" />
        </nav>
      </aside>
    </>
  )
}
```

#### RunAuditButton (`app/projects/[id]/urls/[urlId]/run-audit-button.tsx`)

```typescript
'use client'

export function RunAuditButton({ targetUrlId }: { targetUrlId: string }) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function handleRun() {
    startTransition(async () => {
      const result = await triggerAudit(targetUrlId)
      if (result.ok) {
        toast.success('检测完成')
        router.refresh()  // 刷新 SSR 数据
      } else {
        toast.error(result.error)  // 直接显示 Server Action 返回的错误
      }
    })
  }

  return (
    <button onClick={handleRun} disabled={pending}>
      {pending ? '检测中...' : '运行检测'}
    </button>
  )
}
```

#### ScoreTrendChart (`components/ScoreTrendChart.tsx`)

```typescript
'use client'

interface Props {
  data: TrendPoint[]    // 来自 getScoreTrend()
  className?: string
}

export function ScoreTrendChart({ data, className }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Legend />
        {/* 四条线，null 值自动连接 */}
        <Line dataKey="performance" stroke="#10B981" connectNulls strokeWidth={2} />
        <Line dataKey="accessibility" stroke="#3B82F6" connectNulls strokeWidth={2} />
        <Line dataKey="bestPractices" stroke="#8B5CF6" connectNulls strokeWidth={2} />
        <Line dataKey="seo" stroke="#F59E0B" connectNulls strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

### 6.4 UI 组件库 (`components/ui/index.tsx`)

| 组件 | 实现方式 | Tailwind 类 |
|------|---------|------------|
| `Button` | `<button>` + variants: primary/secondary/ghost/danger + sizes | 直接绑定 |
| `Card` | `<div className="bg-white rounded-xl ...">` | 静态 |
| `Badge` | `<span>` + color variants | 通过 props.color |
| `Skeleton` | `<div className="animate-pulse bg-gray-200 ...">` | 静态 |
| `Input` | `<input className="w-full rounded-lg border ...">` | 静态 |
| `Label` | `<label className="text-sm font-medium ...">` | 静态 |
| `Textarea` | `<textarea>` + 与 Input 相同的样式 | 静态 |
| `Select` | `<select>` + 自定义下拉箭头 | 静态 |

---

## 7. 关键配置项

### 7.1 Next.js 配置 (`next.config.ts`)

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // standalone 输出：Docker 多阶段构建的关键
  output: 'standalone',

  // 不让 nft 追踪这些包（它们依赖 Chrome 二进制等）
  serverExternalPackages: [
    'lighthouse',
    'chrome-launcher',
    'chrome-remote-interface',
  ],

  // 补充 nft 追踪器遗漏的文件
  outputFileTracingIncludes: {
    '/**': [
      // Lighthouse 用 fs.readFileSync 动态读取 locale JSON，
      // nft 追踪器只跟踪 import/require，无法发现
      './node_modules/lighthouse/shared/localization/locales/**/*.json',
    ],
  },

  // ESM 模块兼容
  experimental: {
    esmExternals: 'loose',
  },
}

export default nextConfig
```

### 7.2 环境变量一览

| 变量 | 默认值 | 作用域 | 说明 |
|------|--------|--------|------|
| `PORT` | `3000` | 运行时 | Next.js 监听端口 |
| `DATA_DIR` | `./data` | 运行时 | SQLite DB + 报告存储目录 |
| `REPORTS_SUBDIR` | `reports` | 运行时 | 报告文件子目录（相对 DATA_DIR） |
| `NODE_ENV` | `production` | Docker | Node.js 环境模式 |
| `TZ` | `Asia/Shanghai` | Docker | 容器时区 |
| `CHROME_PATH` | `/usr/bin/google-chrome-stable` | Docker | Chrome 可执行文件路径 |
| `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` | `true` | 构建时 | 跳过 chrome-launcher 的 Chromium 下载 |
| `NEXT_TELEMETRY_DISABLED` | `1` | 运行时 | 禁用 Vercel 遥测 |

### 7.3 Tailwind CSS v4 配置 (`app/globals.css`)

```css
@import "tailwindcss";

@theme {
  --color-primary: #6366f1;     /* Indigo-500 */
  --color-primary-dark: #4f46e5;
  --color-primary-light: #818cf8;
  --color-surface: #ffffff;
  --color-surface-alt: #f9fafb;
}

/* 暗色模式 */
.dark {
  --color-primary: #818cf8;
  --color-surface: #111827;
  --color-surface-alt: #1f2937;
}
```

---

## 8. 类型系统

完整类型定义位于 `types/index.ts`，以下按实体分组：

### 8.1 数据实体

```typescript
// === 项目 ===
interface Project {
  id: string
  name: string
  description: string | null
  color: string | null
  createdAt: Date
  updatedAt: Date
}

interface ProjectWithStats extends Project {
  urlCount: number
  lastAuditAt: Date | null
  avgScore: number | null
}

// === 检测目标 ===
interface TargetUrl {
  id: string
  projectId: string
  url: string
  alias: string | null
  device: 'mobile' | 'desktop'
  categories: string          // JSON.parse 后为 string[]
  timeoutSecs: number
  createdAt: Date
  updatedAt: Date
}

// === 检测记录 ===
type AuditStatus = 'pending' | 'running' | 'completed' | 'failed'

interface AuditRecord {
  id: string
  targetUrlId: string
  status: AuditStatus
  scorePerformance: number | null
  scoreAccessibility: number | null
  scoreBestPractices: number | null
  scoreSeo: number | null
  fcp: number | null    // ms
  lcp: number | null    // ms
  tbt: number | null    // ms
  cls: number | null    // 无量纲
  si: number | null     // ms
  tti: number | null    // ms
  reportPath: string | null
  reportHtmlPath: string | null
  errorMsg: string | null
  durationMs: number | null
  createdAt: Date
  completedAt: Date | null
}

interface AuditDetail extends AuditRecord {
  targetUrl: TargetUrl
  project: Project
}
```

### 8.2 分页与趋势

```typescript
// 分页参数
interface PaginationOpts {
  page?: number
  pageSize?: number
  startDate?: Date
  endDate?: Date
}

// 分页结果
interface AuditRecordPage {
  records: AuditRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 趋势数据点
interface TrendPoint {
  date: string              // 'YYYY-MM-DD'
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}
```

### 8.3 解析报告

```typescript
interface ParsedReport {
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

interface Opportunity {
  id: string
  title: string
  description: string
  score: number | null          // 0-100
  numericValue: number | null   // 节省量（ms 或 bytes）
  displayValue: string | null   // 人类可读格式
}

interface Diagnostic {
  id: string
  title: string
  description: string
  displayValue: string | null
}
```

### 8.4 Drizzle Schema 类型

```typescript
// lib/db/schema.ts — 由 Drizzle ORM 自动推断
// drizzle-kit introspect 生成或手动定义
// 类型与上方接口一一对应，但字段使用 snake_case
```

---

## 9. Docker 构建管道

### 9.1 多阶段构建流程

```
Stage 1: builder (node:22-slim)
─────────────────────────────────
FROM node:22-slim AS builder

# 安装编译依赖（sharp 的 C++ 编译）
apt-get install -y python3 make g++

# 安装 pnpm
npm install -g pnpm@9.15.0

# 安装应用依赖
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

# 复制源码并构建
COPY . .
RUN mkdir -p data
RUN pnpm db:setup            # 创建空表（被 volume 覆盖，仅做验证）
RUN pnpm build               # next build → .next/standalone

# 关键修复：覆盖 standalone 的 node_modules
# Next.js standalone 只包含 nft 追踪到的依赖，
# serverExternalPackages 的包完全缺失
RUN rm -rf .next/standalone/node_modules
RUN cp -r node_modules .next/standalone/node_modules


Stage 2: runner (node:22-slim)
─────────────────────────────────
FROM node:22-slim AS runner

# 安装 Google Chrome
RUN apt-get update
RUN apt-get install -y wget gnupg
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | \
    gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
RUN echo "deb [signed-by=/usr/share/keyrings/google-chrome.gpg] \
    https://dl.google.com/linux/chrome/deb/ stable main" \
    > /etc/apt/sources.list.d/google-chrome.list
RUN apt-get update && apt-get install -y google-chrome-stable

# 安装 Chrome headless 系统依赖
RUN apt-get install -y \
    ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libatk1.0-0 libcups2 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libu2f-udev libvulkan1 libxcomposite1 libxdamage1 libxkbcommon0 \
    libxrandr2 xdg-utils

# 环境变量
ENV NODE_ENV=production
ENV CHROME_PATH=/usr/bin/google-chrome-stable
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Asia/Shanghai
ENV DATA_DIR=/app/data
ENV PORT=3300

# 复制构建产物
COPY --from=builder /app/.next/standalone /app
COPY --from=builder /app/.next/static /app/.next/static
COPY --from=builder /app/public /app/public
COPY --from=builder /app/scripts/init-db.mjs /app/scripts/init-db.mjs

# 安全：非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3300

# 启动：先建表，再启动服务
CMD ["sh", "-c", "node scripts/init-db.mjs && node server.js"]
```

### 9.2 docker-compose.yml 运行时配置

```yaml
services:
  lighthouse-monitor:
    build: .
    ports:
      - "3300:3300"
    volumes:
      - app_data:/app/data   # 持久化 DB + 报告
    restart: unless-stopped
    mem_limit: 2g
    init: true               # tini 处理僵尸进程（Chrome 子进程回收）
    shm_size: 1g             # Chrome headless 最小需求

volumes:
  app_data:
```

---

## 10. CI/CD 部署管道

### 10.1 GitHub Actions 工作流 (`.github/workflows/deploy.yml`)

```
触发: push to main | workflow_dispatch (手动)
────────────────────────────────────────
Job: deploy
  runs-on: ubuntu-latest
  timeout-minutes: 30

  Steps:
  ┌──────────────────────────────────────┐
  │ 1. Checkout                          │
  │    actions/checkout@v4               │
  ├──────────────────────────────────────┤
  │ 2. Build Docker Image                │
  │    docker build -t lighthouse-monitor │
  ├──────────────────────────────────────┤
  │ 3. Export Image                      │
  │    docker save -o image.tar          │
  ├──────────────────────────────────────┤
  │ 4. Setup SSH                         │
  │    mkdir ~/.ssh                      │
  │    echo $SSH_KEY > ~/.ssh/id_rsa     │
  │    ssh-keyscan $HOST >> known_hosts  │
  ├──────────────────────────────────────┤
  │ 5. Transfer Image to Server          │
  │    scp image.tar user@host:/tmp/    │
  ├──────────────────────────────────────┤
  │ 6. Deploy Container                  │
  │    ssh user@host << 'EOF'           │
  │      docker load -i /tmp/image.tar   │
  │      docker stop monitor || true     │
  │      docker rm monitor || true       │
  │      docker run -d \                 │
  │        --name monitor \              │
  │        --init \                      │
  │        --shm-size=1g \               │
  │        --memory=2g \                 │
  │        -p 3300:3300 \                │
  │        -v app_data:/app/data \       │
  │        --restart=unless-stopped \    │
  │        lighthouse-monitor            │
  │      rm /tmp/image.tar               │
  │    EOF                                │
  ├──────────────────────────────────────┤
  │ 7. Health Check                      │
  │    curl -f http://host:3300          │
  │    (等待 5 秒后重试，最多 12 次)       │
  └──────────────────────────────────────┘
```

### 10.2 所需 GitHub Secrets

| Secret 名 | 说明 | 示例 |
|-----------|------|------|
| `ALIYUN_HOST` | 目标服务器 IP | `<SERVER_IP>`（配置在 GitHub Secrets 中） |
| `ALIYUN_USERNAME` | SSH 用户名 | `root` |
| `ALIYUN_SSH_KEY` | SSH 私钥（完整内容） | `-----BEGIN OPENSSH PRIVATE KEY-----\n...` |
| `ALIYUN_PORT` | SSH 端口 | `22` |

---

## 11. 安全模型

### 11.1 报告文件访问控制

```typescript
// app/api/report/[recordId]/route.ts 的安全校验序列

// Step 1: 从 DB 验证 record 存在
const record = await db.query.audit_records.findFirst({
  where: eq(audit_records.id, recordId),
})
if (!record) return 404

// Step 2: 路径白名单 — 只允许 data/reports/ 目录
const allowedDir = path.resolve('data/reports/')
const filePath = path.resolve(record.reportHtmlPath)
if (!filePath.startsWith(allowedDir)) {
  return new NextResponse('Forbidden', { status: 403 })
}

// Step 3: 扩展名白名单 — 只允许 .html（或 .json for /json 端点）
if (path.extname(filePath) !== '.html') {
  return new NextResponse('Forbidden', { status: 403 })
}

// Step 4: 文件存在检查
if (!fs.existsSync(filePath)) {
  return new NextResponse('Report not found', { status: 404 })
}
```

### 11.2 路径遍历防护原理

```
用户请求: /api/report/../../etc/passwd

Step 2:
  path.resolve('data/reports/../../etc/passwd')
  → '/app/etc/passwd'

  '/app/etc/passwd'.startsWith('/app/data/reports/')
  → false → 403 Forbidden

用户请求: /api/report/a1B2c3D4e5F6

Step 1: DB 查询 record.reportHtmlPath
  → 'data/reports/a1B2c3D4e5F6.html'  (trusted, 来自 DB)

Step 2:
  path.resolve('data/reports/a1B2c3D4e5F6.html')
  → '/app/data/reports/a1B2c3D4e5F6.html'
  → startsWith → true → 放行 ✓
```

### 11.3 已知安全缺口（见第 13 节优化规划）

- **无认证系统**：所有 API 和页面公开可访问
- **无速率限制**：`/api/audit` 可被频繁调用导致资源耗尽
- **无 CSRF 保护**：所有 Server Actions 对任何来源开放
- **报告文件无访问日志**：没有审计谁在下载报告

---

## 12. 目录结构全览

```
lighthouse-monitor/
├── app/
│   ├── globals.css              # Tailwind v4 主题变量 + 全局样式
│   ├── layout.tsx               # 根布局：Sidebar + Toaster
│   ├── page.tsx                 # 首页重定向 → /projects
│   │
│   ├── api/
│   │   ├── audit/
│   │   │   └── route.ts         # POST /api/audit（触发检测）
│   │   └── report/
│   │       └── [recordId]/
│   │           ├── route.ts     # GET HTML 报告
│   │           └── json/
│   │               └── route.ts # GET JSON 报告下载
│   │
│   ├── projects/
│   │   ├── page.tsx             # 项目列表（force-dynamic）
│   │   ├── delete-button.tsx    # 项目删除按钮（客户端）
│   │   ├── new/
│   │   │   └── page.tsx         # 新建项目表单
│   │   └── [id]/
│   │       ├── page.tsx         # 项目详情 + URL 列表（force-dynamic）
│   │       ├── url-create-form.tsx
│   │       ├── url-delete-button.tsx
│   │       ├── edit/
│   │       │   └── page.tsx     # 编辑项目
│   │       └── urls/
│   │           └── [urlId]/
│   │               ├── page.tsx # URL 检测记录列表
│   │               ├── run-audit-button.tsx
│   │               └── records/
│   │                   └── [recordId]/
│   │                       └── page.tsx  # 检测详情
│   │
│   ├── audits/
│   │   └── page.tsx             # 全局检测记录
│   │
│   ├── not-found.tsx            # 404 页面
│   └── error.tsx                # 500 错误页面
│
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx          # 响应式导航
│   ├── shared/
│   │   └── EmptyState.tsx       # 空状态占位组件
│   ├── ui/
│   │   └── index.tsx            # 8 个 UI 基础组件
│   ├── ScoreTrendChart.tsx      # Recharts 四线趋势图
│   └── ToasterProvider.tsx      # Sonner 配置
│
├── lib/
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema（3 表 + 索引）
│   │   └── client.ts            # Proxy 延迟初始化
│   ├── lighthouse/
│   │   ├── runner.ts            # 核心运行器（300+ 行）
│   │   └── parser.ts            # LHR 解析 + 中文化
│   ├── actions/
│   │   ├── projects.ts          # CRUD + 统计聚合
│   │   ├── urls.ts              # CRUD
│   │   └── audits.ts            # CRUD + 分页 + 趋势 + trigger
│   └── utils/
│       └── index.ts             # cn, formatDate, getScoreColor 等
│
├── types/
│   └── index.ts                 # 全部 TypeScript 类型
│
├── scripts/
│   ├── init-db.mjs              # Docker 启动时建表（幂等）
│   └── copy-externals.mjs       # 已废弃（被完整 node_modules 方案取代）
│
├── data/                        # 运行时数据（Docker volume）
│   ├── lighthouse.db            # SQLite 数据库
│   └── reports/                 # 报告文件
│
├── doc/
│   ├── tech-sharing.md          # 技术分享文档（偏复盘/分享）
│   └── technical-spec.md        # 本文件（偏代码级参考）
│
├── Dockerfile                   # 多阶段构建
├── docker-compose.yml           # 容器运行时配置
├── next.config.ts               # Next.js standalone + 外部包 + 追踪
├── package.json                 # 依赖 + scripts
├── pnpm-lock.yaml               # 锁文件（pnpm@9.15.0）
├── tsconfig.json                # strict: true
├── drizzle.config.ts            # Drizzle Kit 配置
├── postcss.config.mjs           # @tailwindcss/postcss
├── eslint.config.mjs            # Flat Config + FlatCompat
├── .npmrc                       # pnpm 允许构建配置
├── .dockerignore                # 精确保留构建必需文件
├── .gitignore
└── .github/
    └── workflows/
        └── deploy.yml           # CI/CD 管道
```

---

## 13. 后续优化规划

### 13.1 功能增强

| 优先级 | 项目 | 技术方案 | 预估工时 |
|--------|------|---------|---------|
| **P0** | 定时自动检测 | `node-cron` 库 + 每 URL 的 `cron_expression` 配置列 | 1d |
| **P0** | 性能分阈值告警 | 比较最新 N 次平均分，超过下降阈值 → Webhook/DingTalk/Email | 1d |
| **P1** | 检测队列化 | BullMQ + Redis：异步执行、失败重试、并发控制 | 3d |
| **P1** | 用户系统 | NextAuth.js + SQLite adapter、JWT session | 2d |
| **P2** | 结果对比 | 两次记录差分视图：Δ 评分、Δ Vitals | 1d |
| **P2** | 瀑布图集成 | 从 LHR 提取 waterfall 数据，自定义渲染 | 3d |
| **P2** | 邮件报告 | 周报/月报 PDF，包含趋势图 | 2d |

### 13.2 性能与基础设施

| 优先级 | 项目 | 当前状态 | 目标 |
|--------|------|---------|------|
| **P0** | 服务器升级 | 2核2G | 4核8G（恢复 simulate 模式） |
| **P1** | 数据库迁移 | SQLite 本地 | Turso/libSQL Cloud 或 PostgreSQL |
| **P1** | CDN 报告 | 本地 disk | Cloudflare R2 / 阿里云 OSS |
| **P2** | 结构化日志 | `console.error` | pino + 阿里云 SLS |

### 13.3 代码质量

| 优先级 | 项目 | 说明 |
|--------|------|------|
| P1 | 单元测试 | `lib/lighthouse/parser.ts` 解析逻辑、`lib/utils/index.ts` |
| P1 | 集成测试 | Server Actions CRUD + Lighthouse runner mock |
| P2 | E2E 测试 | Playwright：创建项目 → 添加 URL → 运行检测 → 查看结果 |
| P2 | 类型严格化 | 消除残留 `as any` 断言（lighthouse dynamic import） |

### 13.4 安全加固

| 优先级 | 项目 | 说明 |
|--------|------|------|
| P1 | API 认证 | 配合用户系统，所有路由添加 auth middleware |
| P1 | 速率限制 | `/api/audit` 每人每分钟最多 N 次 |
| P2 | 输入校验 | Zod schema 校验所有 Server Action 入参 |
| P2 | 报告访问审计 | 记录每次报告查看/下载的事件日志 |

---

> **文档版本**: v1.0  
> **最后更新**: 2026-06-26  
> **文件位置**: `doc/technical-spec.md`
