import { FileQuestion, FolderOpen, ClipboardCheck } from 'lucide-react'
import Link from 'next/link'

type EmptyType = 'project' | 'url' | 'audit'

const config: Record<EmptyType, { icon: typeof FileQuestion; title: string; description: string; actionLabel?: string; actionHref?: string }> = {
  project: {
    icon: FolderOpen,
    title: '还没有项目',
    description: '创建一个项目开始监控你的网页性能',
    actionLabel: '创建项目',
    actionHref: '/projects/new',
  },
  url: {
    icon: FileQuestion,
    title: '还没有检测网址',
    description: '在这个项目中添加需要监控的网页地址',
  },
  audit: {
    icon: ClipboardCheck,
    title: '还没有检测记录',
    description: '点击上方「运行检测」按钮开始第一次检测',
  },
}

interface Props {
  type: EmptyType
  /** 自定义描述，覆盖默认值 */
  description?: string
}

export default function EmptyState({ type, description }: Props) {
  const { icon: Icon, title, description: defaultDescription, actionLabel, actionHref } = config[type]

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">{description ?? defaultDescription}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}
