# Multi-stage Dockerfile for Next.js Standalone on Coolify
FROM node:20-alpine AS base

# 1. Install dependencies only when needed
FROM base AS deps
# `apk add libc6-compat` DIHAPUS 4 Okt 2026.
#
# Alasannya: baris itu tidak pernah dipakai. node:20-alpine sudah berbasis
# musl, dan tidak ada dependency di package.json yang butuh glibc (dicek:
# 32 dependency, nol binding native). Diverifikasi langsung di VPS:
# `node -e "require('fs')"` jalan normal di node:20-alpine tanpa libc6-compat.
#
# Dihapus karena `apk add` adalah panggilan jaringan PERTAMA di build, dan
# /etc/resolv.conf di VPS hanya punya SATU nameserver (1.1.1.1) yang
# kadang gagal resolve. Satu packet hilang = build gagal total padahal
# tidak ada yang salah pada kodenya. Baris aslinya berasal dari commit
# f813afd dan tidak pernah ditanya sejak itu.
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# 2. Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# 3. Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
