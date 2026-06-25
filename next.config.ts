/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@libsql/client', 'lighthouse', 'chrome-launcher'],
}

module.exports = nextConfig
