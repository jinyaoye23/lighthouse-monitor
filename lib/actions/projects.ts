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
  // Use drizzle query builder — compatible across all drivers
  const allProjects = await db.select().from(projects).orderBy(desc(projects.updatedAt))

  // Fetch URL stats separately (avoids raw SQL driver differences)
  const stats = await db
    .select({
      projectId: targetUrls.projectId,
      count: sql<number>`COUNT(*)`.mapWith(Number),
      lastAuditAt: sql<number | null>`MAX(${auditRecords.createdAt})`.mapWith((v) => v ? Number(v) : null),
      avgScore: sql<number | null>`ROUND(AVG(${auditRecords.scorePerformance}), 0)`.mapWith((v) => v !== null ? Number(v) : null),
    })
    .from(targetUrls)
    .leftJoin(auditRecords, eq(auditRecords.targetUrlId, targetUrls.id))
    .groupBy(targetUrls.projectId)

  // Build stats map
  const statsMap = new Map<string, { urlCount: number; lastAuditAt: Date | null; avgScore: number | null }>()
  for (const s of stats) {
    statsMap.set(s.projectId, {
      urlCount: s.count,
      lastAuditAt: s.lastAuditAt ? new Date(s.lastAuditAt) : null,
      avgScore: s.avgScore,
    })
  }

  return allProjects.map((p) => {
    const stat = statsMap.get(p.id)
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      color: p.color,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      urlCount: stat?.urlCount ?? 0,
      lastAuditAt: stat?.lastAuditAt ?? null,
      avgScore: stat?.avgScore ?? null,
    }
  })
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
