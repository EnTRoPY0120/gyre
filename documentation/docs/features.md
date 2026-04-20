---
sidebar_position: 5
---

# Features

Gyre provides a comprehensive set of features for managing FluxCD and Kubernetes resources.

## Dashboard

### Overview

The main dashboard provides a high-level view of cluster health and Flux resource status using built-in overview cards.

### Built-in Panels

- **Cluster Connectivity** - Current API connectivity status for the active cluster
- **Resource Group Totals** - Aggregated totals/health per Flux resource group
- **Inventory Architecture** - Group-level breakdown of managed resources
- **Admin Readiness** - State-driven setup status for cluster access, auth, and backups
- **System Shortcuts** - Quick navigation to common operational pages

## Resource Management

### Supported FluxCD Resources

**Source Controller:**

- GitRepositories
- HelmRepositories
- HelmCharts
- Buckets
- OCIRepositories

**Kustomize Controller:**

- Kustomizations

**Helm Controller:**

- HelmReleases

**Notification Controller:**

- Alerts
- Providers
- Receivers

### Resource Views

**List View:**

- Filter by namespace, status, type
- Sort by any column
- Bulk actions
- Real-time updates via SSE

**Detail View:**

- Full resource YAML
- Live status and conditions
- Related resources
- Event history
- Action buttons (suspend, resume, reconcile)

### Actions

- **Reconcile** - Trigger immediate reconciliation
- **Suspend** - Pause automated reconciliation
- **Resume** - Resume automated reconciliation
- **Delete** - Remove resource (with confirmation)

## Real-time Updates

### Server-Sent Events (SSE)

- Live resource status updates
- Event streaming
- Automatic reconnection
- Efficient state synchronization

### Benefits

- No manual refresh needed
- See changes immediately
- Track reconciliation progress
- Monitor resource health

## Multi-Cluster Support

### Cluster Management

- Add multiple Kubernetes clusters
- Switch between clusters easily
- Per-cluster resource views
- Unified dashboard across clusters

### Configuration

- Import kubeconfig contexts
- Automatic cluster discovery
- Context switching in UI
- Cluster-specific RBAC

## Authentication & SSO

### Authentication Methods

**Local Authentication:**

- Username/password
- bcrypt password hashing
- Secure session management
- Password policies

**Single Sign-On (SSO):**

- GitHub OAuth
- Google OAuth
- GitLab OAuth
- Generic OIDC/OAuth2 provider
- Auto-provision users

### Session Management

- Secure HTTP-only cookies
- CSRF protection on state-changing requests
- Session invalidation on logout

## RBAC (Role-Based Access Control)

### Roles

**Admin:**

- Full system access
- User management
- Cluster configuration
- RBAC policy management

**Editor:**

- View all resources
- Create and modify resources
- Suspend/resume resources
- Trigger reconciliations

**Viewer:**

- View resources
- Read-only access
- Cannot modify resources

### Policy Configuration

- **Resource Types** - Control access per resource type
- **Namespaces** - Restrict to specific namespaces
- **Clusters** - Limit to specific clusters
- **Actions** - Granular action permissions (view, create, edit, delete)

### Audit Logging

All actions are logged with:

- Timestamp
- User identity
- Action performed
- Resource affected
- Success/failure status
- Configurable log retention

## Resource Creation Wizard

### Flux Resource Templates

Create new resources with guided forms:

- **Kustomization** - Deploy kustomize overlays
- **HelmRelease** - Deploy Helm charts
- **GitRepository** - Configure Git sources
- **HelmRepository** - Add Helm chart repos
- **Alerts** - Set up notifications
- And more...

### Features

- Form validation
- YAML preview
- Template suggestions
- One-click apply

## Search & Filter

### Global Search

- Search across all resources
- Fuzzy matching
- Real-time results
- Keyboard shortcuts

### Filters

- Filter by:
  - Resource type
  - Namespace
  - Status (Ready, Not Ready, Unknown)
  - Cluster
  - Custom labels

## Dark Mode

- Automatic system preference detection
- Manual toggle in UI
- Consistent dark theme across all pages
- Optimized for low-light environments

## Mobile Responsive

- Works on all screen sizes
- Touch-friendly interface
- Responsive tables
- Collapsible sidebar

## Keyboard Shortcuts

- `Ctrl/Cmd + K` - Open search
- `Ctrl/Cmd + /` - Show shortcuts
- Navigation shortcuts
- Quick actions

## API Access

### RESTful API

- Full API access
- Session-based authentication
- JSON responses
- Pagination support

### Endpoints

- `/api/v1/auth/*` - Login/logout/password change and OAuth flows
- `/api/v1/flux/*` - Flux resource operations
- `/api/v1/events` - SSE stream for real-time updates
- `/api/v1/admin/*` - Admin settings, backups, and auth provider management
- `/api/v1/user/preferences` - User-level UI preferences

## Security

### Protection Mechanisms

- **CSRF Protection** - Cross-site request forgery prevention on all state-changing endpoints
- **Rate Limiting & Account Lockout** - Brute-force protection on authentication endpoints
- **Input Sanitization** - Server-side validation and sanitization of all user input
- **Secure Sessions** - HTTP-only cookies with configurable expiry

## Observability

### Prometheus Metrics

- Exposed at `/metrics` endpoint
- Kubernetes ServiceMonitor support for Prometheus Operator
- Request rates, error rates, and latency histograms
- Active session and cluster connection gauges

## Reliability

### Graceful Shutdown

- In-flight request draining before shutdown
- Clean session cleanup on termination
- SSE connection teardown without data loss

## Future Features

Planned features (roadmap):

- Advanced alerting
- GitOps workflow visualization
- Multi-tenancy support
- Custom resource definitions (CRDs)
- Webhook integrations
- Slack/Discord notifications
