'use server'

import { db } from '@/lib/db/client'
import { targetUrls } from '@/lib/db/schema'
import { nanoid } from 'nanoid'
import { eq, and, desc, sql } from 'drizzle-orm'
import type { TargetUrl } from '@/types'

export async function createTargetUrl(data: {
  projectId: string
  url: string
  alias?: string
  device?: 'mobile' | 'desktop'
  categories?: string[]
  timeoutSecs?: number
}): Promise<TargetUrl> {
  const id = nanoid()
  const now = Date.now()

  const result = await db.insert(targetUrls).values({
    id,
    projectId: data.projectId,
    url: data.url,
    alias: data.alias ?? null,
    device: data.device ?? 'mobile',
    categories: JSON.stringify(data.categories ?? ['performance', 'accessibility', 'best-practices', 'seo']),
    timeoutSecs: data.timeoutSecs ?? 60,
    createdAt: new Date(now),
    updatedAt: new Date(now),
  }).returning()

  return result[0] as unknown as TargetUrl
}

export async function getTargetUrls(projectId: string): Promise<TargetUrl[]> {
  const rows = db.select().from(targetUrls)
    .where(eq(targetUrls.projectId, projectId))
    .orderBy(desc(targetUrls.createdAt))
  return rows as unknown as TargetUrl[]
}

export async function getTargetUrl(id: string): Promise<TargetUrl | null> {
  const rows = await db.select().from(targetUrls).where(eq(targetUrls.id, id))
  return (rows[0] as unknown as TargetUrl) ?? null
}

export async function updateTargetUrl(id: string, data: {
  url?: string
  alias?: string
  device?: 'mobile' | 'desktop'
  categories?: string[]
  timeoutSecs?: number
}): Promise<TargetUrl> {
  const updateData: Record<string, unknown> = { updatedAt: new Date() }
  if (data.url !== undefined) updateData.url = data.url
  if (data.alias !== undefined) updateData.alias = data.alias
  if (data.device !== undefined) updateData.device = data.device
  if (data.categories !== undefined) updateData.categories = JSON.stringify(data.categories)
  if (data.timeoutSecs !== undefined) updateData.timeoutSecs = data.timeoutSecs

  const rows = await db.update(targetUrls)
    .set(updateData)
    .where(eq(targetUrls.id, id))
    .returning()
  return rows[0] as unknown as TargetUrl
}

export async function deleteTargetUrl(id: string): Promise<void> {
  await db.delete(targetUrls).where(eq(targetUrls.id, id))
}
