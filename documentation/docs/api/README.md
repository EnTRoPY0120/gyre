---
sidebar_position: 7
---

# API Reference

Gyre provides a RESTful API for programmatic access to all features.

## Overview

Base URL: `https://your-gyre-instance/api`

Authentication: Session cookie or API token

Content-Type: `application/json`

## Authentication

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

Response:

```json
{
	"success": true,
	"user": {
		"id": "...",
		"username": "admin",
		"role": "admin"
	}
}
```

### Logout

```http
POST /api/auth/logout
```

## Flux Resources

### List Resources

```http
GET /api/flux/[resourceType]?namespace=default&cluster=default
```

Parameters:

- `namespace` - Filter by namespace
- `cluster` - Filter by cluster context

Response:

```json
{
  "resources": [...],
  "total": 42
}
```

### Get Resource

```http
GET /api/flux/[resourceType]/[namespace]/[name]?cluster=default
```

### Create Resource

```http
POST /api/flux/[resourceType]
Content-Type: application/json

{
  "cluster": "default",
  "resource": { ... }
}
```

### Update Resource

```http
PUT /api/flux/[resourceType]/[namespace]/[name]
Content-Type: application/json

{
  "cluster": "default",
  "resource": { ... }
}
```

### Delete Resource

```http
DELETE /api/flux/[resourceType]/[namespace]/[name]?cluster=default
```

### Resource Actions

```http
POST /api/flux/[resourceType]/[namespace]/[name]/reconcile
POST /api/flux/[resourceType]/[namespace]/[name]/suspend
POST /api/flux/[resourceType]/[namespace]/[name]/resume
```

## Clusters

### List Clusters

```http
GET /api/clusters
```

### Add Cluster

```http
POST /api/clusters
Content-Type: application/json

{
  "name": "production",
  "kubeconfig": "...",
  "context": "default"
}
```

### Remove Cluster

```http
DELETE /api/clusters/[clusterId]
```

## Users

### List Users

```http
GET /api/users
```

### Create User

```http
POST /api/users
Content-Type: application/json

{
  "username": "newuser",
  "password": "...",
  "role": "editor"
}
```

### Update User

```http
PUT /api/users/[userId]
Content-Type: application/json

{
  "role": "admin"
}
```

### Delete User

```http
DELETE /api/users/[userId]
```

## RBAC

### List Policies

```http
GET /api/rbac/policies
```

### Create Policy

```http
POST /api/rbac/policies
Content-Type: application/json

{
  "name": "developer-policy",
  "rules": [
    {
      "resources": ["kustomizations", "helmreleases"],
      "namespaces": ["default", "staging"],
      "actions": ["view", "edit"]
    }
  ]
}
```

### Assign Policy to User

```http
POST /api/rbac/bindings
Content-Type: application/json

{
  "userId": "...",
  "policyId": "...",
  "cluster": "default"
}
```

## Events

### Get Events

```http
GET /api/events?namespace=default&limit=50
```

Parameters:

- `namespace` - Filter by namespace
- `limit` - Maximum results (default: 50)

## Health

### Health Check

```http
GET /api/health
```

Response:

```json
{
	"status": "healthy",
	"version": "0.1.0",
	"clusters": [
		{
			"name": "default",
			"connected": true
		}
	]
}
```

## WebSocket

### Real-time Updates

Connect to WebSocket for live updates:

```javascript
const ws = new WebSocket('wss://your-gyre-instance/api/ws');

ws.onmessage = (event) => {
	const update = JSON.parse(event.data);
	console.log('Resource update:', update);
};
```

## Error Handling

All errors follow this format:

```json
{
	"error": {
		"code": "RESOURCE_NOT_FOUND",
		"message": "Resource not found",
		"details": {}
	}
}
```

Common HTTP status codes:

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

## Rate Limiting

API requests are rate-limited per user:

- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

## Pagination

List endpoints support pagination:

```http
GET /api/flux/kustomizations?page=1&limit=20
```

Response includes:

```json
{
  "resources": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

_Full API documentation coming soon. For now, explore the API routes in `src/routes/api/`._
