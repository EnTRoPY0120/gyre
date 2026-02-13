# syntax=docker/dockerfile:1.4
# =============================================================================
# Stage 1: Builder - Build the SvelteKit application
# =============================================================================
FROM oven/bun:1.3.9-alpine AS builder

WORKDIR /build

# Install Node.js (required for SvelteKit build)
RUN apk add --no-cache nodejs

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

# =============================================================================
# Stage 2: Runtime - Production image with security hardening
# =============================================================================
FROM node:25-alpine3.23 AS runtime

# Add metadata labels
LABEL org.opencontainers.image.title="Gyre" \
      org.opencontainers.image.description="Modern WebUI for FluxCD" \
      org.opencontainers.image.vendor="Gyre Project" \
      org.opencontainers.image.source="https://github.com/EnTRoPY0120/gyre"

# Install CA certificates, curl, and build tools for native modules
RUN apk add --no-cache ca-certificates python3 make g++ curl

# Install Kustomize (direct binary download for Alpine with checksum verification)
ARG KUSTOMIZE_VERSION=v5.6.0
ARG KUSTOMIZE_SHA256=54e4031ddc4e7fc59e408da29e7c646e8e57b8088c51b84b3df0864f47b5148f
RUN curl -sSL -o /tmp/kustomize.tgz \
      "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2F${KUSTOMIZE_VERSION}/kustomize_${KUSTOMIZE_VERSION}_linux_amd64.tar.gz" && \
    echo "${KUSTOMIZE_SHA256}  /tmp/kustomize.tgz" | sha256sum -c - && \
    tar -xzf /tmp/kustomize.tgz -C /usr/local/bin && \
    chmod +x /usr/local/bin/kustomize && \
    kustomize version && \
    rm -f /tmp/kustomize.tgz

# Create non-root user for security
RUN addgroup -g 1001 -S gyre && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G gyre -g gyre gyre

WORKDIR /app

# Copy built application from builder (with proper ownership)
COPY --from=builder --chown=gyre:gyre /build/build ./build
COPY --from=builder --chown=gyre:gyre /build/package.json ./package.json
COPY --from=builder --chown=gyre:gyre /build/drizzle ./drizzle

# Install production dependencies
# We omit the cache mount to avoid 'idealTree' conflict and clean up build tools in same layer
RUN npm install --omit=dev && \
    npm cache clean --force && \
    apk del python3 make g++

# Create data directory for SQLite database (PVC mount point)
RUN mkdir -p /data && chown -R gyre:gyre /data

# Switch to non-root user
USER gyre

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production \
    PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/flux/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
# Node.js 18+ handles signals properly, no init system needed
CMD ["node", "build/index.js"]
