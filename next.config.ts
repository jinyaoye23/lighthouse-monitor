import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
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