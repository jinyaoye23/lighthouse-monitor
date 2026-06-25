import { Activity, Search } from 'lucide-react'

export default function AuditsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">检测记录</h1>
        <p className="text-muted-foreground mt-1">查看所有检测记录，需先创建项目并添加检测 URL</p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-2xl">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Search className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">暂无检测记录</h3>
        <p className="text-muted-foreground text-sm">创建项目并添加检测 URL 后，执行检测即可在此查看记录</p>
      </div>
    </div>
  )
}
