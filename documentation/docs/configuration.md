---
sidebar_position: 3
---

# Configuration

Configure Gyre through Helm values and environment variables.

## Overview

Production deployments are expected to run in-cluster via Helm/GitOps.
Out-of-cluster configuration is mainly for local development/testing.

Recommended order of precedence:

1. Helm values (`charts/gyre/values.yaml`)
2. Environment variables (directly, or injected by Helm)

## Helm Configuration

### Base Example

```yaml
replicaCount: 1

image:
  repository: ghcr.io/entropy0120/gyre
  tag: ''
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

serviceAccount:
  create: true
  # Default keeps ServiceAccount token mounted for in-cluster auth.
  automount: true

ingress:
  enabled: false

persistence:
  enabled: true
  accessMode: ReadWriteOnce
  size: 1Gi
```

### Authentication

```yaml
auth:
  localLoginEnabled: true
  allowSignup: false
  domainAllowlist: []
  providers: []
  providersExistingSecret: ''
```

`auth.providers` entries support OAuth/OIDC providers (for example GitHub, Google, GitLab, and generic OIDC/OAuth2).
Provider objects are metadata-only and must not include `clientSecret`.

When `auth.providers` is non-empty, `auth.providersExistingSecret` is required.
Provider client secrets are read from secret keys named:

- `PROVIDER_<SANITIZED_PROVIDER_NAME>_CLIENT_SECRET`

### Runtime / Performance

```yaml
config:
  pollIntervalMs: 5000
  heartbeatIntervalMs: 30000
  dashboardCacheTtlMs: 30000
  settlingPeriodMs: 30000
  bodySizeLimit: 500M
  additionalConfig: {}
```

`config.additionalConfig` is passed through as extra environment variables.
`config.additionalConfig.BODY_SIZE_LIMIT` is reserved and rejected by the chart; use `config.bodySizeLimit`.

### Encryption and Secrets

```yaml
encryption:
  existingSecret: gyre-encryption
```

The referenced secret must provide:

- `GYRE_ENCRYPTION_KEY`
- `AUTH_ENCRYPTION_KEY`
- `BACKUP_ENCRYPTION_KEY`
- `BETTER_AUTH_SECRET`

## Environment Variables

### Core Runtime Variables

| Variable                | Description                                   | Default / Notes                                                          |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| `DATABASE_URL`          | SQLite database path                          | `/data/gyre.db` in-cluster, `./data/gyre.db` local fallback              |
| `GYRE_ENCRYPTION_KEY`   | Encryption key for stored kubeconfigs         | 64-char hex (32 bytes), required in production                           |
| `AUTH_ENCRYPTION_KEY`   | Encryption key for auth/OAuth secrets         | 64-char hex (32 bytes), required in production                           |
| `BETTER_AUTH_URL`       | Public app origin used for auth callback URLs | `http://localhost:5173` in `.env.example`                                |
| `BETTER_AUTH_SECRET`    | Better Auth session signing secret            | Required in production; must be distinct from encryption keys            |
| `ADMIN_PASSWORD`        | Optional initial admin password               | If unset, Gyre auto-generates; weak values fail in production/in-cluster |
| `BACKUP_ENCRYPTION_KEY` | Backup-file encryption key                    | 64-char hex; required in production, optional in development             |
| `NODE_ENV`              | Runtime mode                                  | `development` / `production`                                             |
| `BODY_SIZE_LIMIT`       | Adapter-level max request body size           | Set to `>= 500M` for kubeconfig/backup uploads                           |

### Tunable Constants

| Variable                               | Description                                    | Default                                         |
| -------------------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| `GYRE_POLL_INTERVAL_MS`                | Kubernetes polling interval                    | `5000`                                          |
| `GYRE_HEARTBEAT_INTERVAL_MS`           | SSE heartbeat interval                         | `30000`                                         |
| `GYRE_DASHBOARD_CACHE_TTL_MS`          | Dashboard cache TTL                            | `30000`                                         |
| `GYRE_SETTLING_PERIOD_MS`              | Settling period for ADDED events               | `30000`                                         |
| `GYRE_SETTINGS_CACHE_TTL_MS`           | Settings cache TTL                             | `30000`                                         |
| `GYRE_MAX_LOCAL_BACKUPS`               | Max local backups retained                     | `10`                                            |
| `GYRE_METRICS_TOKEN`                   | Bearer token for `/metrics`                    | Required in production; optional in development |
| `GYRE_SSE_MAX_CONNECTIONS_PER_SESSION` | Max SSE connections per session                | `3`                                             |
| `GYRE_SSE_MAX_CONNECTIONS_PER_USER`    | Max SSE connections per user                   | `5`                                             |
| `GYRE_SSE_CONNECTION_TIMEOUT_MS`       | SSE connection lifetime (`0` disables timeout) | `0`                                             |

### Auth Settings Overrides

| Variable                                                     | Description                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `GYRE_AUTH_LOCAL_LOGIN_ENABLED`                              | Enable/disable local username/password login                     |
| `GYRE_AUTH_ALLOW_SIGNUP`                                     | Allow OAuth auto-signup                                          |
| `GYRE_AUTH_DOMAIN_ALLOWLIST`                                 | JSON array of allowed signup domains                             |
| `GYRE_AUTH_PROVIDERS`                                        | JSON array used to seed auth providers (no `clientSecret` field) |
| `GYRE_AUTH_PROVIDER_<SANITIZED_PROVIDER_NAME>_CLIENT_SECRET` | Per-provider secret input for seeded providers                   |

## Helm-to-Env Mapping

Helm values map directly to runtime env vars:

| Helm key                     | Environment variable            |
| ---------------------------- | ------------------------------- |
| `config.pollIntervalMs`      | `GYRE_POLL_INTERVAL_MS`         |
| `config.heartbeatIntervalMs` | `GYRE_HEARTBEAT_INTERVAL_MS`    |
| `config.dashboardCacheTtlMs` | `GYRE_DASHBOARD_CACHE_TTL_MS`   |
| `config.settlingPeriodMs`    | `GYRE_SETTLING_PERIOD_MS`       |
| `config.bodySizeLimit`       | `BODY_SIZE_LIMIT`               |
| `auth.localLoginEnabled`     | `GYRE_AUTH_LOCAL_LOGIN_ENABLED` |
| `auth.allowSignup`           | `GYRE_AUTH_ALLOW_SIGNUP`        |
| `auth.domainAllowlist`       | `GYRE_AUTH_DOMAIN_ALLOWLIST`    |
| `auth.providers`             | `GYRE_AUTH_PROVIDERS`           |

## Applying Configuration

```bash
helm upgrade gyre oci://ghcr.io/entropy0120/charts/gyre \
  --namespace flux-system \
  -f values.yaml
```
