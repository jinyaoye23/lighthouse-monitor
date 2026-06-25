import { createClient, type Client } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as schema from './schema'
import path from 'path'
import fs from 'fs'

const DB_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'lighthouse.db')
  : path.join(process.cwd(), 'data', 'lighthouse.db')

let _client: Client | null = null
let _db: LibSQLDatabase<typeof schema> | null = null

function getClient(): Client {
  if (_client) return _client

  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  _client = createClient({ url: `file:${DB_PATH}` })
  _client.execute('PRAGMA journal_mode=WAL').catch(() => {})
  _client.execute('PRAGMA foreign_keys=ON').catch(() => {})
  return _client
}

function getDb(): LibSQLDatabase<typeof schema> {
  if (_db) return _db
  _db = drizzle(getClient(), { schema })
  return _db
}

// Proxy to lazy-init — avoids module-level fs / DB creation during Next.js build
export const db = new Proxy({} as LibSQLDatabase<typeof schema>, {
  get(_target, prop) {
    const real = getDb()
    const val = (real as unknown as Record<string | symbol, unknown>)[prop]
    if (typeof val === 'function') {
      return (...args: unknown[]) => (val as (...a: unknown[]) => unknown).apply(real, args)
    }
    return val
  },
})

export { schema }
