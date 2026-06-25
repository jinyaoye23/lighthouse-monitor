/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  serverExternalPackages: [
    '@libsql/client',
    'lighthouse',
    'chrome-launcher',
    'chrome-remote-interface',
  ],
}

module.exports = nextConfig
