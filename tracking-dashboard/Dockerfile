# =============================================================
# Stage 1: deps — Install ALL dependencies (including dev for native rebuild)
# =============================================================
FROM node:20-alpine AS deps

# Install build tools needed for native modules (better-sqlite3)
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    sqlite-dev

WORKDIR /app

COPY package.json package-lock.json* ./

# Install ALL deps so we can rebuild native modules
RUN npm ci

# Rebuild better-sqlite3 for the current Alpine/Node ABI
RUN npm rebuild better-sqlite3

# =============================================================
# Stage 2: builder — Build Next.js app
# =============================================================
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat python3 make g++ sqlite-dev

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Dummy env agar Next.js build tidak error saat import db
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tracking_db
ENV NEXTAUTH_SECRET=build-time-placeholder
ENV NEXTAUTH_URL=http://localhost:3000

RUN npm run build

# =============================================================
# Stage 3: runner — Minimal production image
# =============================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache \
    libc6-compat \
    sqlite-dev \
    postgresql-client

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy standalone Next.js output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy scripts & package.json (needed for manual sync)
COPY --chown=nextjs:nodejs scripts/ ./scripts/
COPY --chown=nextjs:nodejs package.json ./

# Copy node_modules with rebuilt native modules
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Ensure data & logs dir exist with proper permissions (SQLite & Logger)
RUN mkdir -p /app/data /app/logs && chown -R nextjs:nodejs /app/data /app/logs

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
