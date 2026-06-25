import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | number): string {
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatMs(ms: number | null): string {
  if (ms === null || ms === undefined) return '—'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)} s`
  return `${ms.toFixed(0)} ms`
}

export function getScoreColor(score: number | null): string {
  if (score === null || score === undefined) return 'text-gray-400'
  if (score >= 90) return 'text-green-500'
  if (score >= 50) return 'text-yellow-500'
  return 'text-red-500'
}

export function getScoreBgColor(score: number | null): string {
  if (score === null || score === undefined) return 'bg-gray-400'
  if (score >= 90) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function getScoreLabel(score: number | null): string {
  if (score === null || score === undefined) return 'N/A'
  if (score >= 90) return 'Good'
  if (score >= 50) return 'Needs Improvement'
  return 'Poor'
}

export const CATEGORY_LABELS: Record<string, string> = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best Practices',
  seo: 'SEO',
}

export const CATEGORY_COLORS: Record<string, string> = {
  performance: '#3b82f6',
  accessibility: '#8b5cf6',
  'best-practices': '#f59e0b',
  seo: '#10b981',
}
