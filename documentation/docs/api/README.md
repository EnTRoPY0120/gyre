---
sidebar_position: 7
---

# API Reference

Gyre exposes versioned HTTP endpoints under `/api/v1/*`.

## Overview

Base URL: `https://<host>/api/v1`

Authentication: Session cookie (`gyre_session`)

Content-Type: `application/json`

Compatibility note: unversioned `/api/*` paths are internally rewritten to `/api/v1/*` for backward compatibility (`src/hooks.ts`). The documented contract is `/api/v1/*`.

## Process Health and Readiness

```http
GET /api/v1/health
GET /api/v1/ready
```

`/api/v1/health` is a lightweight liveness endpoint and returns `200 { "status": "ok" }` when the process can answer HTTP requests.

`/api/v1/ready` reports initialization readiness. It returns `200 { "status": "ready" }` after startup initialization completes, `503 { "status": "initializing", "message": "Gyre initialization has not completed" }` while startup is still in progress, and `503 { "status": "failed", "message": "Gyre initialization failed" }` after a fatal initialization error.

## Authentication

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

### Logout

```http
POST /api/v1/auth/logout
```

### Change Password

```http
POST /api/v1/auth/change-password
Content-Type: application/json

{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

### OAuth / OIDC

```http
GET /api/v1/auth/{providerId}/login
GET /api/v1/auth/{providerId}/callback
```

## Flux Resources

### List Resources

```http
GET /api/v1/flux/{resourceType}?limit=50&offset=0&sortBy=name&sortOrder=asc
```

### Create Resource

```http
POST /api/v1/flux/{resourceType}
Content-Type: application/json

{
  "apiVersion": "source.toolkit.fluxcd.io/v1",
  "kind": "GitRepository",
  "metadata": {
    "name": "app-config",
    "namespace": "flux-system"
  },
  "spec": {
    "interval": "1m",
    "url": "https://github.com/org/repo"
  }
}
```

### Get / Update / Delete Resource

```http
GET /api/v1/flux/{resourceType}/{namespace}/{name}
PUT /api/v1/flux/{resourceType}/{namespace}/{name}
DELETE /api/v1/flux/{resourceType}/{namespace}/{name}
```

### Resource Actions

```http
POST /api/v1/flux/{resourceType}/{namespace}/{name}/reconcile
POST /api/v1/flux/{resourceType}/{namespace}/{name}/suspend
POST /api/v1/flux/{resourceType}/{namespace}/{name}/resume
POST /api/v1/flux/{resourceType}/{namespace}/{name}/rollback
```

### Batch Actions

```http
POST /api/v1/flux/batch/reconcile
POST /api/v1/flux/batch/suspend
POST /api/v1/flux/batch/resume
POST /api/v1/flux/batch/delete
```

### Resource Diagnostics

```http
GET /api/v1/flux/{resourceType}/{namespace}/{name}/events
GET /api/v1/flux/{resourceType}/{namespace}/{name}/history
GET /api/v1/flux/{resourceType}/{namespace}/{name}/logs
GET /api/v1/flux/{resourceType}/{namespace}/{name}/diff
```

### Overview / Health / Version

```http
GET /api/v1/flux/overview
GET /api/v1/flux/events
GET /api/v1/flux/health
GET /api/v1/flux/version
```

## SSE Stream

Use Server-Sent Events for real-time updates:

```javascript
const events = new EventSource('/api/v1/events');

events.onmessage = (event) => {
	const payload = JSON.parse(event.data);
	console.log('SSE event:', payload);
};
```

## Admin Endpoints

These routes require an authenticated admin user:

```http
GET /api/v1/admin/settings
PATCH /api/v1/admin/settings

GET /api/v1/admin/auth-providers
POST /api/v1/admin/auth-providers
GET /api/v1/admin/auth-providers/{id}
PATCH /api/v1/admin/auth-providers/{id}
DELETE /api/v1/admin/auth-providers/{id}

GET /api/v1/admin/backups
POST /api/v1/admin/backups
DELETE /api/v1/admin/backups?filename=<name>
GET /api/v1/admin/backups/download?filename=<name>
POST /api/v1/admin/backups/restore

POST /api/v1/admin/k8s/clear-client-pool
```

`PATCH /api/v1/admin/settings` is all-or-nothing. Unknown fields, invalid value types, invalid `auditRetentionDays`, and non-string `domainAllowlist` entries return `400` without persisting any setting. Settings locked by environment variables return `409` and name the locked field and owning env var instead of being silently ignored.

## User Preferences

```http
POST /api/v1/user/preferences
```

## API Explorer

Interactive OpenAPI explorer:

```http
GET /api/docs
GET /api/docs/openapi.json
```

## Error Handling

Errors are returned as JSON with an HTTP status code. Example:

```json
{
	"error": "Forbidden",
	"message": "Permission denied"
}
```

---

For implementation details, inspect `src/routes/api/v1/`.
