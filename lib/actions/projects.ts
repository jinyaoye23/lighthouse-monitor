'use server'

import { db } from '@/lib/db/client'
import { projects, targetUrls, auditRecords } from '@/lib/db/schema'
import { nanoid } from 'nanoid'
import { eq, desc, sql } from 'drizzle-orm'
import type { Project } from '@/types'

export async function createProject(data: {
  name: string
  description?: string
  color?: string
}): Promise<Project> {
  const id = nanoid()
  const now = Date.now()

  const result = await db.insert(projects).values({
    id,
    name: data.name,
    description: data.description ?? null,
    color: data.color ?? '#6366f1',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }).returning()

  const row = result[0]
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as Project
}

export async function getProjects() {
  const rows = db.all<Record<string, unknown>>(sql`
    SELECT
      p.id, p.name, p.description, p.color, p.created_at, p.updated_at,
      COALESCE(tu.url_count, 0) AS url_count,
      tu.last_audit_at,
      tu.avg_score
    FROM projects p
    LEFT JOIN (
      SELECT
        project_id,
        COUNT(*) AS url_count,
        MAX(ar.created_at) AS last_audit_at,
        ROUND(AVG(ar.score_performance), 0) AS avg_score
      FROM target_urls
      LEFT JOIN audit_records ar ON ar.target_url_id = target_urls.id
      GROUP BY project_id
    ) tu ON tu.project_id = p.id
    ORDER BY p.updated_at DESC
  `)

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: (row.description as string) ?? null,
    color: (row.color as string) ?? null,
    createdAt: new Date(row.created_at as number),
    updatedAt: new Date(row.updated_at as number),
    urlCount: Number(row.url_count),
    lastAuditAt: row.last_audit_at ? new Date(row.last_audit_at as number) : null,
    avgScore: row.avg_score !== null ? Number(row.avg_score) : null,
  }))
}

export async function getProject(id: string): Promise<Project | null> {
  const rows = await db.select().from(projects).where(eq(projects.id, id))
  if (!rows[0]) return null
  return {
    id: rows[0].id,
    name: rows[0].name,
    description: rows[0].description,
    color: rows[0].color,
    createdAt: rows[0].createdAt,
    updatedAt: rows[0].updatedAt,
  } as Project
}

export async function updateProject(id: string, data: {
  name?: string
  description?: string
  color?: string
}): Promise<Project> {
  const rows = await db.update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning()
  return {
    id: rows[0].id,
    name: rows[0].name,
    description: rows[0].description,
    color: rows[0].color,
    createdAt: rows[0].createdAt,
    updatedAt: rows[0].updatedAt,
  } as Project
}

export async function deleteProject(id: string): Promise<void> {
  await db.delete(projects).where(eq(projects.id, id))
}
