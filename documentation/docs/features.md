---
sidebar_position: 5
---

# Features

Gyre provides a comprehensive set of features for managing FluxCD and Kubernetes resources.

## Dashboard

### Overview

The main dashboard provides a high-level view of your cluster's health and status.

### Widgets

- **Resource Counts** - Quick overview of resource totals
- **Recent Events** - Latest cluster events
- **Health Status** - Cluster and resource health indicators
- **Custom Widgets** - Build your own dashboard widgets

### Customization

- Drag-and-drop widget arrangement
- Multiple dashboard layouts
- Save and share dashboard configurations

## Resource Management

### Supported FluxCD Resources

**Source Controller:**

- GitRepositories
- HelmRepositories
- HelmCharts
- Buckets
- ExternalArtifacts

**Kustomize Controller:**

- Kustomizations

**Helm Controller:**

- HelmReleases

**Notification Controller:**

- Alerts
- Providers
- Receivers

**Image Automation:**

- ImageRepositories
- ImagePolicies
- ImageUpdateAutomation

### Resource Views

**List View:**

- Filter by namespace, status, type
- Sort by any column
- Bulk actions
- Real-time updates

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

### WebSocket Connection

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
- Generic OIDC provider
- Auto-provision users

### Session Management

- Secure HTTP-only cookies
- Configurable session timeout
- Concurrent session control
- Session revocation

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

## Inventory System

### Resource Relationships

Visualize relationships between Flux resources:

- Source → Kustomization → Deployments
- HelmRepository → HelmChart → HelmRelease
- ImageRepository → ImagePolicy → ImageUpdateAutomation

### Tree View

- Hierarchical resource display
- Expand/collapse branches
- Click to navigate
- See downstream impacts

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
- Authentication via tokens or sessions
- JSON responses
- Pagination support

### Endpoints

- `/api/flux/*` - Flux resource operations
- `/api/clusters` - Cluster management
- `/api/auth/*` - Authentication
- `/api/users` - User management
- `/api/rbac/*` - RBAC policies

## Future Features

Planned features (roadmap):

- Prometheus metrics integration
- Advanced alerting
- GitOps workflow visualization
- Multi-tenancy support
- Custom resource definitions (CRDs)
- Webhook integrations
- Slack/Discord notifications
