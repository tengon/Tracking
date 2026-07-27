# =============================================================
# Stage 1: deps — Install dependencies & rebuild native modules
# =============================================================
FROM node:20-alpine AS deps

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    sqlite-dev

WORKDIR /app

COPY package.json package-lock.json* ./

# Install all dependencies (including dev) to enable native rebuild
RUN npm ci

# Rebuild better-sqlite3 for Alpine/Node ABI
RUN npm rebuild better-sqlite3

# =============================================================
# Stage 2: builder — Build Next.js standalone app
# =============================================================
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++ sqlite-dev

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time placeholder environment variables
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tracking_db
ENV NEXTAUTH_SECRET=build-time-placeholder
ENV NEXTAUTH_URL=http://localhost:3000

RUN npm run build

# =============================================================
# Stage 3: runner — Production image with security hardening
# =============================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache \
    libc6-compat \
    sqlite-dev \
    postgresql-client \
    wget

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user and group
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy Next.js standalone output and assets with correct permissions
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy auxiliary scripts, source code & package configuration
COPY --chown=nextjs:nodejs scripts/ ./scripts/
COPY --chown=nextjs:nodejs src/ ./src/
COPY --chown=nextjs:nodejs tsconfig.json ./
COPY --chown=nextjs:nodejs package.json ./

# Copy node_modules with rebuilt native modules
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Create persistent storage directories for SQLite and API logs
RUN mkdir -p /app/data /app/logs && chown -R nextjs:nodejs /app/data /app/logs

USER nextjs

EXPOSE 3000

# Container healthcheck using Next.js /api/health route
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
