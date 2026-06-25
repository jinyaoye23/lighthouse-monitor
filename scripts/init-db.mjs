// Production DB initialization — runs at container startup.
// Uses CREATE TABLE IF NOT EXISTS so it's safe to run every deploy.

import { createClient } from '@libsql/client'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'

const DB_PATH = process.env.DATA_DIR
  ? join(process.env.DATA_DIR, 'lighthouse.db')
  : join(process.cwd(), 'data', 'lighthouse.db')

mkdirSync(dirname(DB_PATH), { recursive: true })

const client = createClient({ url: `file:${DB_PATH}` })

async function migrate() {
  await client.execute('PRAGMA journal_mode=WAL')
  await client.execute('PRAGMA foreign_keys=ON')

  await client.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#6366f1',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS target_urls (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      alias TEXT,
      device TEXT DEFAULT 'mobile',
      categories TEXT NOT NULL DEFAULT '["performance","accessibility","best-practices","seo"]',
      timeout_secs INTEGER DEFAULT 60,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS audit_records (
      id TEXT PRIMARY KEY,
      target_url_id TEXT NOT NULL REFERENCES target_urls(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      score_performance REAL,
      score_accessibility REAL,
      score_best_practices REAL,
      score_seo REAL,
      fcp REAL,
      lcp REAL,
      tbt REAL,
      cls REAL,
      si REAL,
      tti REAL,
      report_path TEXT,
      report_html_path TEXT,
      error_msg TEXT,
      duration_ms INTEGER,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );
  `)

  await client.execute('CREATE INDEX IF NOT EXISTS idx_target_urls_project_id ON target_urls(project_id)')
  await client.execute('CREATE INDEX IF NOT EXISTS idx_audit_records_target_url_id ON audit_records(target_url_id)')
  await client.execute('CREATE INDEX IF NOT EXISTS idx_audit_records_created_at ON audit_records(created_at)')
  await client.execute('CREATE INDEX IF NOT EXISTS idx_audit_records_status ON audit_records(status)')

  console.log('[init-db] Database ready at', DB_PATH)
}

migrate().finally(() => client.close())
