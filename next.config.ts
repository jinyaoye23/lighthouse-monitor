/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3', 'lighthouse', 'chrome-launcher'],
}

module.exports = nextConfig
