# Lighthouse Monitor — 项目技术分享与沉淀

> 一个基于 Next.js 15 的全栈 Web 性能持续检测平台，从零到部署上线阿里云的完整技术记录。

---

## 目录

1. [项目概述](#1-项目概述)
2. [技术架构](#2-技术架构)
3. [开发历程](#3-开发历程)
4. [部署上线全流程](#4-部署上线全流程)
5. [部署上线踩坑记录](#5-部署上线踩坑记录)
6. [Docker 环境 Lighthouse 性能调优](#6-docker-环境-lighthouse-性能调优)
7. [技术沉淀与经验教训](#7-技术沉淀与经验教训)
8. [待优化项与后续规划](#8-待优化项与后续规划)

---

## 1. 项目概述

### 1.1 功能

- **项目管理**：创建项目 → 添加待检测 URL → 配置设备类型和检测类别
- **自动化检测**：编程式运行 Google Lighthouse（headless Chrome），支持移动端/桌面端
- **结果展示**：四维评分环形图（性能/可访问性/最佳实践/SEO）、Web Vitals 指标、优化建议、诊断信息
- **趋势分析**：Recharts 折线图展示历史评分变化
- **报告下载**：保留 Lighthouse 原生 HTML 报告（中文化）和 JSON 数据

### 1.2 技术栈

| 层级 | 选型 | 理由 |
|------|------|------|
| 框架 | Next.js 15 App Router | SSR + Server Actions + API Routes |
| UI | React 19 + Tailwind CSS v4 | 零运行时 CSS，原子化样式 |
| 图表 | Recharts 2.13 | React 原生，声明式配置 |
| 数据库 | libSQL (SQLite) + Drizzle ORM | 零运维，WAL 模式支持并发读 |
| Lighthouse | lighthouse 12.x (编程式) | 直接调用 Node API，不依赖 CLI |
| 浏览器 | Google Chrome (headless) | 生产环境与 DevTools 一致 |
| 部署 | Docker + GitHub Actions → 阿里云 | 镜像分发，CI/CD 全自动 |
| 包管理 | pnpm 9.15 | 严格解析，锁定版本 |

### 1.3 部署地址

- **线上**：`http://<SERVER_IP>:<PORT>`（见 `.env` 或 GitHub Secrets 中的 `ALIYUN_HOST`）
- **GitHub**：`<GITHUB_USERNAME>/lighthouse-monitor`
- **服务器**：阿里云 2核2G，Docker 容器化运行

---

## 2. 技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────┐
│                   User Browser                    │
└────────────┬────────────────────────────────────┘
             │ HTTP
┌────────────▼────────────────────────────────────┐
│           Next.js 15 App Router                   │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  │
│  │  Server    │  │   API      │  │  Server    │  │
│  │ Components │  │   Routes   │  │  Actions   │  │
│  │ (SSR)      │  │            │  │            │  │
│  └─────┬─────┘  └─────┬──────┘  └──────┬─────┘  │
│        │              │                 │        │
│  ┌─────▼──────────────▼─────────────────▼─────┐  │
│  │              Drizzle ORM                     │  │
│  └───────────────────┬─────────────────────────┘  │
│                      │                             │
│  ┌───────────────────▼─────────────────────────┐  │
│  │         libSQL (SQLite, WAL mode)            │  │
│  │         data/lighthouse.db                   │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │      Lighthouse Runner (lib/lighthouse)      │  │
│  │  ┌─────────────┐   ┌──────────────────┐     │  │
│  │  │ chrome-      │   │  lighthouse 12.x │     │  │
│  │  │ launcher      │   │  (programmatic)  │     │  │
│  │  └──────┬──────┘   └────────┬─────────┘     │  │
│  │         │                    │                │  │
│  │  ┌──────▼────────────────────▼──────────┐    │  │
│  │  │    Google Chrome (headless)           │    │  │
│  │  │    /usr/bin/google-chrome-stable      │    │  │
│  │  └──────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │      Reports Storage (data/reports/)         │  │
│  │      *.json + *.html (by recordId)           │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 2.2 数据模型

3 张表，级联删除：

```
projects (项目)
  ├── id (TEXT PK, nanoid)
  ├── name, description, color
  └── created_at, updated_at
       │
       │ 1:N, CASCADE
       ▼
target_urls (检测目标)
  ├── id (TEXT PK, nanoid)
  ├── project_id → projects.id
  ├── url, alias, device (mobile/desktop)
  ├── categories (JSON array)
  └── created_at, updated_at
       │
       │ 1:N, CASCADE
       ▼
audit_records (检测记录)
  ├── id (TEXT PK, nanoid)
  ├── target_url_id → target_urls.id
  ├── status (pending/running/completed/failed)
  ├── score_performance/accessibility/best_practices/seo
  ├── fcp, lcp, tbt, cls, si, tti (Web Vitals)
  ├── report_path, report_html_path
  ├── error_msg, duration_ms
  └── created_at, completed_at
```

---

## 3. 开发历程

### Phase 0 — 项目脚手架 (`d3490b4`)

- Next.js 15 App Router + TypeScript Strict 模式
- Tailwind CSS v4 + lucide-react 图标
- ESLint Flat Config + Prettier
- Drizzle ORM + SQLite 数据库配置
- 项目目录结构设计

### Phase 1 — 项目 & URL CRUD (`a2cd289` ~ `a7be14a`)

- 项目 CRUD：列表/新建/编辑/删除，卡片式布局 + 8色选择器
- URL 管理：内联展开式表单，设备类型/检测类别多选
- Server Actions 模式：`lib/actions/projects.ts`、`urls.ts`、`audits.ts`
- 数据库延迟初始化 Proxy 模式（避免 Next.js 编译期触发 fs/native 模块）

### Phase 2 — Lighthouse 检测执行 (`62db1eb`)

- `lib/lighthouse/runner.ts`：程序化调用 Lighthouse，动态 import 避免 ESM 冲突
- `lib/lighthouse/parser.ts`：LHR JSON 解析，提取 scores/Web Vitals/opportunities/diagnostics
- 完整 JSON 报告保存到 `data/reports/{recordId}.json`
- 检测结果详情页：评分环形图 + Web Vitals + 优化建议 + 诊断信息

### Phase 3 — 趋势图表 + 中文化 (`7c2a978` ~ `be303a6`)

- Recharts 趋势折线图（四条线，null 值自动插值）
- 30+ audit ID → 中文 title/description 映射表
- Lighthouse HTML 报告保留 + 中文化（`locale: 'zh'`）
- 全局检测记录视图 `/audits`

### Phase 4 — 打磨 + 配置优化 (`a7be14a` ~ )

- Sonner Toast 通知、响应式 Sidebar（hamburger + overlay）
- 404/500 错误页面、空状态组件
- 百度反爬适配（CDP stealth 注入）→ 后续被移除（影响性能）
- `throttlingMethod` 从 `devtools` 改为 `simulate`（对齐 DevTools 评分）
- JSON 报告下载 API

---

## 4. 部署上线全流程

### 4.1 部署架构

```
GitHub (源码)                                     阿里云 (2核2G)
┌───────────┐         GitHub Actions            ┌──────────────────┐
│  push to  │──┬──► Build Docker Image          │  Docker Container │
│   main    │  │   ├── pnpm install             │  ┌─────────────┐  │
└───────────┘  │   ├── pnpm build (standalone)  │  │ Next.js      │  │
               │   └── docker save → image.tar  │  │ Port 3300    │  │
               │                                │  ├─────────────┤  │
               │   ──► SCP image.tar → Server   │  │ Chrome       │  │
               │   ──► SSH: docker load         │  │ headless     │  │
               │   ──► SSH: docker run          │  ├─────────────┤  │
               │       ├── --init (僵尸进程)     │  │ SQLite       │  │
               │       ├── --shm-size=1g (Chrome)│  │ (volume)    │  │
               │       └── --memory=2g           │  └─────────────┘  │
               └──► Health Check (curl :3300)   └──────────────────┘
```

### 4.2 Dockerfile 设计（多阶段构建）

```
Stage 1: builder (node:22-slim)
  ├── 安装 python3/g++ (sharp 编译依赖)
  ├── pnpm install + db:setup (建表)
  ├── pnpm build (Next.js standalone 输出)
  └── 覆盖 standalone node_modules (serverExternalPackages)

Stage 2: runner (node:22-slim)
  ├── 安装 Google Chrome + 系统依赖
  ├── COPY standalone 输出 + static + public
  ├── 创建非 root 用户 (nextjs)
  └── CMD: node init-db.mjs && node server.js
```

### 4.3 CI/CD 流水线 (`.github/workflows/deploy.yml`)

| 步骤 | 操作 | 说明 |
|------|------|------|
| 1. Checkout | `actions/checkout@v4` | 拉取源码 |
| 2. Build | `docker build` | 构建生产镜像 |
| 3. Export | `docker save` → `image.tar` | 导出镜像文件 |
| 4. Transfer | `scp-action` | SCP 传输到阿里云 |
| 5. Deploy | `ssh-action`: `docker load` + `docker run` | 加载并启动容器 |
| 6. Health | `curl localhost:3300` | 验证服务正常 |

**触发条件**：push to main 或手动 workflow_dispatch

---

## 5. 部署上线踩坑记录

以下按排查顺序记录了从代码 push 到服务正常运行遇到的所有问题。

### 5.1 Docker 构建阶段

#### 坑 1：pnpm 安全策略阻止依赖安装

```
ERR_PNPM_OUTDATED_LOCKFILE
ERR_PNPM_MINIMUM_RELEASE_AGE
ERR_PNPM_IGNORED_BUILDS
```

**根因**：pnpm 10.x 新增了三道安全策略——`minimumReleaseAge`（防止安装刚发布的包）、`ignoredBuilds`（跳过非声明的构建脚本）、`ignore-scripts`（禁用所有 install 脚本）。

**解决**：锁死 `pnpm@9.15.0`（无这些安全策略限制），配置 `.npmrc` 声明允许的构建依赖。

#### 坑 2：pnpm-lock.yaml 过期

```
ERR_PNPM_LOCKFILE_MISSING_DEPENDENCY  tsx
```

**根因**：`db:setup` 从 `tsx` 改为 `node --experimental-strip-types` 后，`tsx` 从 package.json 移除，但 lockfile 未重新生成。`--frozen-lockfile` 严格校验一致性。

**解决**：`pnpm install --no-frozen-lockfile` 重新生成 lockfile。

#### 坑 3：ESLint nextVitals is not iterable

**根因**：`eslint-config-next/core-web-vitals` 是 CJS 模块，直接 `import` + `...spread` 报错。

**解决**：改用 `@eslint/eslintrc` 的 `FlatCompat`：
```ts
const compat = new FlatCompat({ baseDirectory: __dirname })
const config = [...compat.extends('next/core-web-vitals', 'next/typescript')]
```

#### 坑 4：TypeScript 类型错误 → CI 构建失败

| 错误 | 原因 | 修复 |
|------|------|------|
| `Property 'projectId' does not exist` | 清理组件时移除 prop 但调用处未更新 | 移除调用处的 `projectId` |
| `Parameter 'r' implicitly has 'any'` | 缺少类型标注 | 导入 `AuditRecord` 类型 |
| `webpack config is not iterable` | webpack 回调类型不兼容 | 改用 `(config: any)` |

#### 坑 5：`.dockerignore` 排除了构建必需文件

| 排除的文件 | 后果 | 修复 |
|-----------|------|------|
| `types/` | `@/types` 模块找不到 | 移除 |
| `next.config.ts` | 不生成 `.next/standalone` | 移除 |
| `lib/` | 业务逻辑缺失 | 不移除 |
| `scripts/` | init-db.mjs 缺失 | 不移除 |

**教训**：`.dockerignore` 精确保留构建必需文件：`next.config.ts`、`tsconfig.json`、`types/`、`lib/`、`scripts/`。

#### 坑 6：Dockerfile RUN node -e 多行脚本解析错误

```
dockerfile parse error on line 34: unknown instruction: const
```

**根因**：`RUN node -e "const fs = require('fs'); ..."` 中的 `const` 被 Docker 解析器误认为指令。

**解决**：内联脚本抽成独立文件 `scripts/copy-externals.mjs`，Dockerfile 改为 `RUN node scripts/copy-externals.mjs`。

### 5.2 运行时问题

#### 坑 7：数据库表未创建（部署后接口 500）

**根因**：Docker persistent volume 挂载到 `/app/data` 时，目录是空的。build 阶段 `pnpm db:setup` 创建的表文件被 volume 覆盖。

**解决**：创建 `scripts/init-db.mjs`（`CREATE TABLE IF NOT EXISTS`，幂等），容器启动时在 `server.js` 之前运行。

#### 坑 8：页面缓存导致数据已入库但列表仍为空

**根因**：`projects/page.tsx` 和 `projects/[id]/page.tsx` 缺少 `export const dynamic = 'force-dynamic'`，Next.js 返回了 build 时的静态缓存。

**解决**：两个关键页面添加 `force-dynamic`。

#### 坑 9：Docker 中 Chrome 无法启动

**根因**：两个问题——
1. Docker 没有 init 进程（PID 1 不回收僵尸进程），Chrome 启动大量子进程后挂起
2. 默认 `/dev/shm` 只有 64MB，Chrome 最少需要 256MB

**解决**：
- `docker run --init`（注入 tini 处理僵尸进程）
- `docker run --shm-size=1g`（扩容共享内存）

#### 坑 10：Lighthouse locale JSON 文件缺失

```
ENOENT: no such file or directory
'/app/node_modules/lighthouse/shared/localization/locales/ar.json'
```

**根因**：Lighthouse 用 `fs.readFileSync` 读取 locale 文件，Next.js standalone 的 nft 追踪器只跟踪 `import`/`require`，不跟踪 `fs.readFileSync`。

**解决**：`next.config.ts` 添加：
```ts
outputFileTracingIncludes: {
  '/**': ['./node_modules/lighthouse/shared/localization/locales/**/*.json']
}
```

#### 坑 11：serverExternalPackages 完整缺失

```
Cannot find package '/app/node_modules/lighthouse/index.js'
```

**根因**：`lighthouse` 在 `serverExternalPackages` 中，nft 追踪器不复制这些包到 standalone 的 `node_modules`。

**初版方案（失败）**：手动复制 `lighthouse`/`chrome-launcher`/`chrome-remote-interface` + 创建 symlink。失败原因是这些包的 **transitive deps**（axe-core 等十几个包）同样缺失。

**最终方案**：在 builder 阶段 build 完成后，用完整的 `node_modules` 覆盖 standalone 的精简版：
```dockerfile
RUN rm -rf .next/standalone/node_modules \
    && cp -r node_modules .next/standalone/node_modules
```

**代价**：Docker 镜像体积增大（但保证所有包可用）。

#### 坑 12：Server Action 错误信息不可见

**根因**：Server Action 中 `throw new Error()`，Next.js production 环境只返回 digest，前端看不到实际错误信息。

**解决**：`triggerAudit` 改为返回结构化响应：
```ts
{ ok: true, recordId } | { ok: false, error: string }
```
前端 `RunAuditButton` 直接 `toast.error(error)` 显示。

---

## 6. Docker 环境 Lighthouse 性能调优

### 6.1 问题现象

| 环境 | 性能分 | LCP | FCP | 备注 |
|------|--------|-----|-----|------|
| Chrome DevTools (本地) | **95** | 1.7s | 1.3s | 用户开发机 |
| Docker (初始) | **66** | 3.4s | 1.5s | 25 个 disable 标志 |
| Docker (第1轮优化) | **74** | 3.0s | 1.7s | 精简标志 |
| Docker (第2轮优化) | **74** | ~3.0s | ~1.7s | 去 stealth + shm |
| Docker (Google Chrome) | **65** | 5.2s | — | Chrome 更重，内存不够 |
| Docker (provided 模式) | **待验证** | — | — | 当前方案 |

### 6.2 逐层排查过程

#### 第一层：Chrome 标志过多（25+ → 5）

**移除的标志（性能杀手）：**

| 标志 | 影响 | 严重程度 |
|------|------|---------|
| `--disable-gpu` | 强制软件渲染，LCP 翻倍 | 🔴 最致命 |
| `--disable-web-security` | 破坏 CORS/SOP，影响请求管线 | 🔴 |
| `--disable-site-isolation-trials` | 改变进程模型 | 🟡 |
| `--disable-features=IsolateOrigins,...` | 同上 | 🟡 |
| 其余 20 个标志 | 累积效应 | 🟡 |

**效果**：66 → 74 (+8 分)

#### 第二层：`--disable-dev-shm-usage` + CDP stealth

**`--disable-dev-shm-usage`**：docker-compose 已给 1GB `/dev/shm`，但这个标志强制 Chrome 全部写 `/tmp` 磁盘 → 渲染性能打折。

**CDP stealth 脚本**：`Page.addScriptToEvaluateOnNewDocument` 注入了完整的反检测脚本，其中 `WebGLRenderingContext.prototype.getParameter` 钩子每次 WebGL 调用都要走 JS wrapper → 累积开销显著。

**效果**：74 (=)，指标有微幅改善但分数不变（百度反爬功能也被移除，donlim.com 不需要）。

#### 第三层：Debian Chromium → Google Chrome

**根因**：Debian 源里的 Chromium 是开源版本，缺少 Google 的私有 V8/GPU 渲染优化。

**修改 Dockerfile**：
```dockerfile
# 原来
apt-get install chromium
ENV CHROME_PATH=/usr/bin/chromium

# 改为
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor
echo "deb [...] https://dl.google.com/linux/chrome/deb/ stable main" > google-chrome.list
apt-get install google-chrome-stable
ENV CHROME_PATH=/usr/bin/google-chrome-stable
```

**效果**：反而降到 65！→ Google Chrome 比 Chromium 更占内存（~500MB vs ~300MB），2核2G 上触发 swap → 基线测量更慢 → simulate 模型推算更差。

#### 第四层：`simulate` → `provided` 节流模式

**终极根因：Lighthouse simulate 模式的数学模型假设运行在 4核8G+ 开发机上。**

simulate 模式的工作原理：
1. 以全速加载页面，记录真实时间线
2. 用数学模型推算出 CPU/网络节流后的分数

在 2核2G 服务器上：
- Chrome headless 吃掉 ~400-500MB
- Node.js 应用 ~200MB
- OS ~200MB
- **总计 ~800-900MB，踩在 2G 上限跑 swap**
- "全速"基线已经慢 2-3 倍 → 模型基于异常慢的基线推算 → 得分极度悲观

**修复**：改用 `throttlingMethod: 'provided'`——如实报告服务器实际渲染性能，不做数学模拟。

```diff
- throttlingMethod: 'simulate',
- throttling: { ... },  // 复杂的自定义节流配置
+ throttlingMethod: 'provided',
```

**定位转变**：
- ❌ ~~对标 Chrome DevTools 绝对分数~~
- ✅ 项目间横向对比 + 时间维度趋势监控

### 6.3 可消除 vs 不可消除的差异

| 差异来源 | 影响力 | 可消除？ |
|---------|--------|---------|
| Chrome 标志过多 | 🔴 大 | ✅ 已修复 |
| `--disable-dev-shm-usage` | 🟡 中 | ✅ 已修复 |
| CDP stealth 脚本 | 🟡 中 | ✅ 已移除 |
| Debian Chromium vs Chrome | 🔴 大 | ✅ 已切换 |
| simulate 在弱服务器上 | 🔴 根本性 | ✅ 改用 provided |
| 阿里云→目标站网络延迟 | 🟡 视站点而定 | ❌ 改服务器地域 |
| vCPU 单核性能 | 🟡 视任务而定 | ❌ 升级实例 |
| 2GB 内存 + Chrome headless | 🔴 边界压力 | ❌ 扩容至 4G+ |

---

## 7. 技术沉淀与经验教训

### 7.1 架构决策

#### Next.js standalone 输出

**利**：Docker 镜像最小化，只包含运行时必需文件。  
**弊**：nft 文件追踪器不完美，以下情况需要手动处理：
- `fs.readFileSync` 动态文件读取 → `outputFileTracingIncludes`
- `serverExternalPackages` 的完整依赖树 → 需要完整 `node_modules`

#### Server Actions 错误处理模式

```ts
// ❌ 错误方式：throw Error
export async function triggerAudit(id: string) {
  throw new Error('Something went wrong')
  // production → 用户只看到 digest，无法排错
}

// ✅ 正确方式：结构化返回
export async function triggerAudit(id: string) {
  try {
    // ...
    return { ok: true, recordId }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
```

#### Proxy 延迟初始化数据库

```ts
// 避免 Next.js 编译期触发 fs/native 模块
const dbProxy: typeof db = new Proxy({} as any, {
  get(_, prop) {
    const real = getDb()  // 首次调用时才初始化
    return (real as any)[prop]
  },
})
```

### 7.2 Docker 部署检查清单

- [ ] `.dockerignore` 不排除构建必需文件（`next.config.ts`、`tsconfig.json`、`types/`、`lib/`）
- [ ] `Dockerfile` 中不在 `RUN` 里写多行内联脚本 → 独立 `.mjs` 文件
- [ ] 跑 Chrome 的容器加 `--init` + `--shm-size=1g`
- [ ] persistent volume 覆盖 build 文件 → 启动时幂等初始化
- [ ] Server Actions 返回结构化错误（不 throw）
- [ ] `force-dynamic` 页面防止生产环境 SSR 缓存
- [ ] `outputFileTracingIncludes` 补充 nft 追踪不到的文件
- [ ] `serverExternalPackages` 的依赖需要完整 `node_modules`

### 7.3 Lighthouse 在 Docker 中的最佳实践

1. **用 Google Chrome 不是 Chromium**（渲染路径不同，差 ~5-10 分）
2. **打开 `chrome://flags` 检查当前标志**——大部分标志对反爬有帮助对性能有损
3. **不要加 `--disable-gpu`**（headless=new 支持 GPU 加速）
4. **不用 `throttlingMethod: 'simulate'`** 在弱服务器上（基线不准）
5. **服务器至少 4核8G** 才能对标 DevTools 分数
6. **`--shm-size=1g`** 必不可少（Chrome 默认 `/dev/shm` 只有 64MB）

### 7.4 关键文件参考

| 文件 | 作用 | 值得注意的点 |
|------|------|-------------|
| `lib/lighthouse/runner.ts` | Lighthouse 运行器 | ESM 动态 import、throttlingMethod 选择 |
| `lib/lighthouse/parser.ts` | 结果解析 | 30+ audit ID 中文化映射 |
| `lib/db/client.ts` | 数据库客户端 | Proxy 延迟初始化、WAL 模式 |
| `scripts/init-db.mjs` | 启动建表 | `IF NOT EXISTS` 幂等 |
| `next.config.ts` | Next.js 配置 | `outputFileTracingIncludes`、`serverExternalPackages` |
| `Dockerfile` | 镜像构建 | 多阶段构建、Google Chrome 安装 |
| `.github/workflows/deploy.yml` | CI/CD | SCP → docker load → docker run |

---

## 8. 待优化项与后续规划

### 8.1 功能增强

#### P0 - 定时自动检测

当前仅支持手动触发检测。应加入定时任务：
- 每个 URL 配置检测频率（每天/每周/每月）
- 使用 cron-job 或在 Next.js 中用 `cron` 库调度
- 检测结果推送通知（邮件/钉钉/企业微信 webhook）

#### P0 - 性能分阈值告警

当某次检测的性能分比前 N 次平均值下降超过 X% 时，自动告警。

#### P1 - 多用户/SaaS 化

- 用户注册/登录
- 项目归属与隔离
- 不同用户的检测配额管理
- 可考虑：NextAuth.js + GitHub OAuth 或简单 JWT

#### P1 - 数据库升级

SQLite → PostgreSQL（或至少 Turso/libSQL cloud）：
- 更好的并发支持
- 远程备份
- 多实例部署

#### P2 - 检测结果对比

选择两次检测记录，对比各指标的差异（红绿 delta 显示）。

#### P2 - 瀑布图/Flamegraph 集成

将 Lighthouse 报告中的 waterfall 集成到自定义页面，不必打开完整 HTML 报告。

#### P2 - 邮件报告

定期发送性能报告邮件（周报/月报），包含趋势图和关键指标变化。

### 8.2 性能优化

#### 服务器升级

2核2G → 4核8G：彻底解决 Chrome headless 的内存压力，让 `simulate` 模式可以用。

#### 检测队列化

当前同步等待 Lighthouse 完成（单次检测 30-60s），如果同时触发多个检测会阻塞。
- 使用 Bull/BullMQ + Redis 实现检测队列
- 前端轮询或 WebSocket 获取检测进度

#### CDN 加速

- Lighthouse HTML 报告（通常 1-3MB）可存到 OSS/CDN
- 静态资源（CSS/JS）已由 Next.js 自带 `/_next/static` 输出

### 8.3 代码质量

#### 类型严格化

部分 `as any` 类型断言（lighthouse import 相关）可以用更精确的类型声明替代。

#### 测试覆盖

当前无测试。应加入：
- 单元测试：`lib/lighthouse/parser.ts` 的解析逻辑
- 集成测试：数据库 CRUD 操作
- E2E 测试：关键用户流程（创建项目 → 添加 URL → 运行检测 → 查看结果）

#### 错误日志

当前错误日志在 `console.error` + 数据库 `error_msg`。生产环境应考虑：
- 结构化日志（pino/winston）
- 日志聚合（到 ELK/阿里云 SLS）

### 8.4 安全加固

- API 级别鉴权（当前无用户系统，所有接口公开）
- 报告文件访问加强（已做路径白名单，可加 token 校验）
- DDoS 防护（单 IP 限流）

---

## 附录：Commit 记录汇总

```
Phase 0-4 功能开发:
  d3490b4 → a2cd289 → 62db1eb → 7c2a978 → dfeeab7
  → 9452a31 → e5a19c2 → be303a6 → a7be14a

反爬适配:
  5a85583 → 43f9afd

性能配置修正:
  c790131 (simulate throttling)

Docker 部署:
  7287a48 → c0f57db → 756f45b → 5609716

Docker 构建修复:
  a63c35d → 1c66345 → e529489 → 169ad06 → c7e4dc2
  → 0625dc6 → 810da3b → b133fb1 → 2b07c02 → b3deecf
  → 520efc3 → a429ac2 → f8058fe → 4002308 → e84b630
  → 0a0967b → e272ec1

Docker 运行时修复:
  45bf965 → bfa6d2a → 1f29bc4 → 24a4a45 → 39eb6f4
  → 385512c → 82964af → 085121a

Lighthouse 性能调优:
  849b08f → 99bf1b4 → 382da1f → e957f4d → 4ac3302
```

---

> **文档版本**：v1.0  
> **最后更新**：2026-06-26  
> **作者**：Senior Developer (高级开发工程师)  
> **副标题**：一个 JavaScript 全栈项目的完整生命周期记录——从 `npm init` 到 `docker run` 的每一步
