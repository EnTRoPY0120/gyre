# syntax=docker/dockerfile:1.4
# =============================================================================
# Stage 0: Build Kustomize from source to ensure latest Go stdlib (fixes CVEs)
# =============================================================================
FROM golang:1.26-alpine AS kustomize-builder
ARG KUSTOMIZE_VERSION=v5.8.1
RUN go install sigs.k8s.io/kustomize/kustomize/v5@${KUSTOMIZE_VERSION}

# =============================================================================
# Stage 1: Builder - Build the SvelteKit application
# =============================================================================
# Use Node.js as the builder base so better-sqlite3 compiles against the same
# Node.js ABI that the runtime uses (avoids ERR_DLOPEN_FAILED at startup).
# Bun is copied in solely for fast installs that respect bun.lock.
FROM node:22-alpine3.23 AS builder

WORKDIR /build

# Copy bun binary from official image for fast, lock-respecting installs
COPY --from=oven/bun:1.3.10-alpine /usr/local/bin/bun /usr/local/bin/bun

# Install native module build tools (better-sqlite3 has no prebuilt musl binaries)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json bun.lock ./

# Install all dependencies (including devDependencies for build)
# Use cache mount for faster rebuilds
RUN --mount=type=cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the SvelteKit application
RUN bun run build

# Prune devDependencies - production node_modules only (respects bun.lock)
RUN bun install --production --frozen-lockfile

# =============================================================================
# Stage 2: Runtime - Production image with security hardening
# =============================================================================
FROM node:22-alpine3.23 AS runtime

# Add metadata labels
LABEL org.opencontainers.image.title="Gyre" \
  org.opencontainers.image.description="Modern WebUI for FluxCD" \
  org.opencontainers.image.vendor="Gyre Project" \
  org.opencontainers.image.source="https://github.com/EnTRoPY0120/gyre"

# Upgrade OS packages to pull in security patches (e.g. zlib CVE-2026-22184)
RUN apk upgrade --no-cache

# Install CA certificates
RUN apk add --no-cache ca-certificates

# Copy Kustomize binary from kustomize-builder
COPY --from=kustomize-builder /go/bin/kustomize /usr/local/bin/kustomize

# Create non-root user for security
RUN addgroup -g 1001 -S gyre && \
  adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G gyre -g gyre gyre

WORKDIR /app

# Copy built application and pruned production node_modules from builder
COPY --from=builder --chown=gyre:gyre /build/build ./build
COPY --from=builder --chown=gyre:gyre /build/package.json ./package.json
COPY --from=builder --chown=gyre:gyre /build/drizzle ./drizzle
COPY --from=builder --chown=gyre:gyre /build/node_modules ./node_modules

# Remove build-tool binaries that are not needed at runtime.
# @esbuild-kit is a transitive dependency of drizzle-kit (dev-only) that leaks
# into the production node_modules copy; its bundled esbuild Go binary (built
# with an old Go stdlib) would otherwise trigger CVE-2024-24790.
# @esbuild/* (e.g. @esbuild/linux-x64) are platform-specific binaries for the
# esbuild bundler, which is only needed at build time; the bundled Go binary
# triggers CVE-2025-68121 (Go crypto/tls, stdlib v1.23.x).
RUN rm -rf /app/node_modules/@esbuild-kit /app/node_modules/@esbuild

# Create data directory for SQLite database (PVC mount point)
RUN mkdir -p /data && chown -R gyre:gyre /data

# Switch to non-root user
USER gyre

# Expose port
EXPOSE 3000

# Environment variables
# BODY_SIZE_LIMIT: adapter-node's built-in body cap (default 512KB).
# Set to 500M to match the largest allowed upload (backup restore) so the
# adapter acts as a hard ceiling while hooks.server.ts enforces per-endpoint
# limits. This also protects against chunked uploads with no Content-Length.
ENV NODE_ENV=production \
  PORT=3000 \
  BODY_SIZE_LIMIT=500M \
  DATABASE_URL=/data/gyre.db \
  KUBECONFIG=/app/.kube/config

# Health check
# /metrics is a lightweight public endpoint that responds regardless of K8s connectivity.
# Avoids false-negative unhealthy status when no kubeconfig is mounted yet.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/metrics', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
# Node.js 22+ handles signals properly, no init system needed
CMD ["node", "build/index.js"]
