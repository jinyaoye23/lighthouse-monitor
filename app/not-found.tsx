import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] text-center">
      <h1 className="text-6xl font-bold text-gray-200">404</h1>
      <h2 className="text-xl font-semibold mt-4 text-gray-900">页面不存在</h2>
      <p className="text-sm text-gray-500 mt-2">你访问的页面可能已被删除或地址有误</p>
      <Link
        href="/projects"
        className="mt-6 inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
      >
        返回项目列表
      </Link>
    </div>
  )
}
