---
sidebar_position: 4
---

# Architecture

Understanding Gyre's architecture helps you deploy, configure, and extend it effectively.

## High-Level Overview

```
┌─────────────────┐
│   User Browser  │
└────────┬────────┘
         │ HTTPS/WebSocket
         ▼
┌─────────────────┐
│   Gyre Pod      │
│  ┌───────────┐  │
│  │  SvelteKit│  │
│  │    UI     │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │  API      │  │
│  │  Routes   │  │
│  └───────────┘  │
│  ┌───────────┐  │
│  │   SQLite  │  │
│  │   (auth,  │  │
│  │   config) │  │
│  └───────────┘  │
└────────┬────────┘
         │ Kubernetes API
         ▼
┌─────────────────┐
│ Kubernetes API  │
│    Server       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   FluxCD        │
│   Resources     │
└─────────────────┘
```

## Components

### Frontend (SvelteKit)

- **Framework**: Svelte 5 with Runes API
- **Styling**: TailwindCSS v4 with custom zinc/gold theme
- **Components**: shadcn-svelte + bits-ui
- **State Management**: Svelte 5 runes-based stores
- **Real-time Updates**: WebSocket client

### Backend (SvelteKit API Routes)

- **Runtime**: Node.js (via adapter-node)
- **API**: RESTful endpoints in `src/routes/api/`
- **Kubernetes**: @kubernetes/client-node for K8s API
- **Authentication**: bcrypt + jose (JWT)
- **Database**: SQLite with Drizzle ORM

### Server-Side Architecture

```
src/lib/server/
├── kubernetes/       # K8s client and Flux utilities
│   ├── client.ts    # K8s API client
│   └── flux/        # FluxCD resource helpers
├── db/              # Database
│   ├── schema.ts    # Drizzle schema
│   └── migrate.ts   # Migration runner
├── auth/            # Authentication
│   ├── oauth/       # OAuth providers
│   └── session.ts   # Session management
├── rbac.ts          # RBAC policies
├── clusters.ts      # Multi-cluster config
└── audit.ts         # Audit logging
```

## Data Flow

### Resource List Request

1. User requests resource list
2. API route validates session
3. RBAC check for permissions
4. Query Kubernetes API for resources
5. Transform and cache response
6. Return JSON to client

### Real-time Updates

1. Client connects to WebSocket
2. Server starts K8s Watch API streams
3. Resource changes trigger WebSocket events
4. Client receives updates and refreshes UI
5. Audit log records actions

## Database Schema

### Core Tables

- **users** - User accounts and credentials
- **sessions** - Active user sessions
- **audit_logs** - Action audit trail
- **clusters** - Multi-cluster configurations
- **rbac_policies** - Access control policies
- **rbac_bindings** - User-policy assignments
- **auth_providers** - SSO/OAuth configurations

## Deployment Model

### In-Cluster Only

Gyre is designed to run **inside** the Kubernetes cluster:

- Uses pod ServiceAccount for authentication
- No kubeconfig file needed
- Accesses K8s API via in-cluster config
- Runs in `flux-system` namespace by default

### Resource Requirements

**Minimum**:

- CPU: 100m
- Memory: 128Mi
- Storage: 1Gi

**Recommended**:

- CPU: 500m
- Memory: 512Mi
- Storage: 5Gi

## Security Model

### Authentication

- **Local**: Username/password with bcrypt hashing
- **SSO**: OAuth 2.0 / OIDC (GitHub, Google, Generic)
- **Sessions**: Secure HTTP-only cookies

### Authorization (RBAC)

- **Roles**: admin, editor, viewer
- **Resources**: Per-type permissions
- **Namespaces**: Per-namespace access
- **Clusters**: Per-cluster permissions

### Audit

All actions logged to `audit_logs` table:

- Timestamp
- User
- Action type
- Resource affected
- Success/failure status

## Caching Strategy

Multi-layer caching reduces K8s API calls:

1. **Server Memory**: 30s TTL for dashboard data
2. **API Responses**: 15s TTL for individual requests
3. **WebSocket**: Invalidates cache on changes

## Technology Stack

| Layer      | Technology                            |
| ---------- | ------------------------------------- |
| Frontend   | SvelteKit 2, Svelte 5, TailwindCSS v4 |
| Backend    | Node.js, SvelteKit API routes         |
| Database   | SQLite (better-sqlite3)               |
| ORM        | Drizzle ORM                           |
| K8s Client | @kubernetes/client-node               |
| Auth       | bcrypt, jose, arctic                  |
| Icons      | lucide-svelte                         |
| UI         | bits-ui, shadcn-svelte                |

## Extensibility

### Adding New Flux Resources

1. Define types in `src/lib/server/kubernetes/flux/types.ts`
2. Add utilities in `src/lib/server/kubernetes/flux/resources.ts`
3. Create API routes in `src/routes/api/flux/[type]/`
4. Add UI components in `src/lib/components/flux/resources/`
5. Update navigation in sidebar

### Custom Dashboard Widgets

1. Create widget component in `src/lib/components/dashboard/`
2. Add to widget registry
3. Configure in database or UI

## Performance Considerations

- **Large Clusters**: Consider increasing resources
- **Multi-cluster**: Each cluster adds API overhead
- **Real-time**: WebSocket connections have limits
- **Database**: SQLite sufficient for most use cases
