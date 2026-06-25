// Run this script with: npx tsx lib/db/setup.ts
// Or import and call in a server action / instrumentation

import { db } from './client'
import { projects, targetUrls, auditRecords } from './schema'

export async function setupDatabase() {
  // Drizzle handles table creation via drizzle-kit migrate,
  // but for simplicity in MVP we do inline CREATE TABLE via the migrate.ts script.
  console.log('Database setup complete.')
}
