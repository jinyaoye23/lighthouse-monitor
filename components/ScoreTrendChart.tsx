'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { CATEGORY_COLORS, CATEGORY_SHORT } from '@/lib/utils'

type TrendData = {
  date: string
  performance: number | null
  accessibility: number | null
  bestPractices: number | null
  seo: number | null
}[]

const CATEGORY_KEYS = ['performance', 'accessibility', 'bestPractices', 'seo'] as const

/** 插值 null 值，避免折线断裂 */
function interpolate(data: TrendData): TrendData {
  if (data.length <= 1) return data
  return data.map((point, i) => {
    const interpolated = { ...point }
    for (const key of CATEGORY_KEYS) {
      if (point[key] != null) continue
      // 找前一个非 null
      let prev: number | null = null
      for (let j = i - 1; j >= 0; j--) {
        if (data[j][key] != null) { prev = data[j][key] as number; break }
      }
      // 找后一个非 null
      let next: number | null = null
      for (let j = i + 1; j < data.length; j++) {
        if (data[j][key] != null) { next = data[j][key] as number; break }
      }
      if (prev != null && next != null) {
        interpolated[key] = Math.round((prev + next) / 2)
      }
    }
    return interpolated
  })
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ dataKey: string; color: string; value: number | null; name: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="text-gray-500 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 py-0.5">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600">{CATEGORY_SHORT[entry.dataKey] ?? entry.name}:</span>
          <span className="font-semibold text-gray-900">{entry.value ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

export default function ScoreTrendChart({ data }: { data: TrendData }) {
  const filled = interpolate(data)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h2 className="text-sm font-medium text-gray-700 mb-4">评分趋势</h2>
      {data.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">暂无趋势数据，请先运行检测</div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filled} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={{ stroke: '#e2e8f0' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value: string) => CATEGORY_SHORT[value] ?? value}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              {CATEGORY_KEYS.map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CATEGORY_COLORS[key] ?? '#94a3b8'}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 0, fill: CATEGORY_COLORS[key] ?? '#94a3b8' }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
