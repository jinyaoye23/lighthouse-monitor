import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

/** 项目表 */
export const projects = sqliteTable('projects', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  description: text('description'),
  color:       text('color').default('#6366f1'),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:   integer('updated_at', { mode: 'timestamp' }).notNull(),
})

/** 检测目标 URL 表 */
export const targetUrls = sqliteTable('target_urls', {
  id:           text('id').primaryKey(),
  projectId:    text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  url:          text('url').notNull(),
  alias:        text('alias'),
  device:       text('device', { enum: ['mobile', 'desktop'] }).default('mobile'),
  categories:   text('categories').notNull().default('["performance","accessibility","best-practices","seo"]'),
  timeoutSecs:  integer('timeout_secs').default(60),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).notNull(),
})

/** 检测记录表 */
export const auditRecords = sqliteTable('audit_records', {
  id:            text('id').primaryKey(),
  targetUrlId:   text('target_url_id').notNull().references(() => targetUrls.id, { onDelete: 'cascade' }),
  status:        text('status', { enum: ['pending', 'running', 'completed', 'failed'] }).default('pending'),

  scorePerformance:    real('score_performance'),
  scoreAccessibility:  real('score_accessibility'),
  scoreBestPractices:  real('score_best_practices'),
  scoreSeo:            real('score_seo'),

  fcp:   real('fcp'),
  lcp:   real('lcp'),
  tbt:   real('tbt'),
  cls:   real('cls'),
  si:    real('si'),
  tti:   real('tti'),

  reportPath:  text('report_path'),
  errorMsg:    text('error_msg'),
  durationMs:  integer('duration_ms'),
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
})
