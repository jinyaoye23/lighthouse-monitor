import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  // Lighthouse 用 fs.readFileSync 读取 locale JSON，不会被 standalone trace 到
  outputFileTracingIncludes: {
    '/**': ['./node_modules/lighthouse/shared/localization/locales/**/*.json'],
  },
  serverExternalPackages: [
    '@libsql/client',
    'lighthouse',
    'chrome-launcher',
    'chrome-remote-interface',
  ],
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
    // Drizzle ORM internally references better-sqlite3 as a transitive type dependency.
    // We provide a null fallback so webpack doesn't fail resolving it during build.
    if (isServer) {
      config.resolve = {
        ...config.resolve,
        fallback: {
          ...(config.resolve?.fallback ?? {}),
          'better-sqlite3': false,
        },
      }
    }
    return config
  },
}

export default nextConfig