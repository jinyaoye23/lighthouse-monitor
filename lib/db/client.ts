import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import path from 'path'

const DB_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'lighthouse.db')
  : path.join(process.cwd(), 'data', 'lighthouse.db')

// Ensure data directory exists
import fs from 'fs'
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const sqlite = new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { schema }
