# ============================================================
# Stage 1: Build
# ============================================================
FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# pnpm
RUN corepack enable

# Dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Source
COPY . .

# Build Next.js standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ============================================================
# Stage 2: Production runtime
# ============================================================
FROM node:22-slim AS runner

# Install Chromium for Lighthouse + system deps for headless Chrome
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    # Chrome headless deps
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libu2f-udev \
    libvulkan1 \
    libxcomposite1 \
    libxdamage1 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Tell chrome-launcher where to find Chromium
ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

WORKDIR /app

# Create non-root user
RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

# Copy standalone output from builder
COPY --from=builder /app/.next/standalone ./
# Standalone mode includes node_modules, but some externals may need the full tree
COPY --from=builder /app/.next/static ./.next/static
# Copy public if exists
COPY --from=builder /app/public ./public

# Ensure data directory exists + is writable
RUN mkdir -p data/reports && chown -R nextjs:nodejs data

# Chrome needs a writable home for some runtime files
RUN mkdir -p /home/nextjs && chown -R nextjs:nodejs /home/nextjs
ENV HOME=/home/nextjs

USER nextjs

EXPOSE 3300

# Start Next.js server (standalone output has server.js)
ENV PORT=3300
CMD ["node", "server.js"]
