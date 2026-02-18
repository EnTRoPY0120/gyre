---
sidebar_position: 7
---

# Development Guide

This guide provides technical information for developers working on the Gyre codebase.

## Project Overview

Gyre is a modern, full-featured WebUI for FluxCD built with SvelteKit and Bun. It provides real-time monitoring, multi-cluster management, built-in RBAC, and comprehensive FluxCD resource management.

**Deployment**: In-cluster-only deployment via Helm chart. Built and run with Bun in production for improved performance and native TypeScript support. Includes production-ready Helm chart, Docker image (published to ghcr.io/entropy0120/gyre), and GitHub Actions CI/CD pipeline.

**Current Status**: Core functionality complete with dashboard, all FluxCD resources, real-time updates, multi-cluster support, authentication/RBAC, Monaco Editor integration, and comprehensive resource templates with complete FluxCD CRD field coverage.

## Common Commands

### Development

**DevContainer (Recommended):**

The easiest way to start developing is using the provided devcontainer:

1. Open repository in VS Code with Dev Containers extension
2. Press `F1` → "Dev Containers: Reopen in Container"
3. Devcontainer automatically installs Bun, VS Code extensions, mounts `~/.kube`, and runs setup
4. Optional: Create local kind cluster with FluxCD for testing

```sh
# Inside devcontainer, start development server
bun run dev

# Optional: Create test cluster
kind create cluster
flux install
```

**Manual Development:**

```sh
bun install              # Install dependencies
bun run dev             # Start development server
bun run dev --open      # Start dev server and open in browser
```

### Code Quality

```sh
bun run check           # Type-check with svelte-check
bun run check:watch     # Type-check in watch mode
bun run lint            # Run prettier and eslint
bun run format          # Format code with prettier
```

### Building & Testing

```sh
bun run build           # Build SvelteKit application
bun run preview         # Preview production build locally

# Docker build
docker build -t gyre:local .
docker run -p 3000:3000 -v $(pwd)/data:/data gyre:local
```

### Production Deployment (Helm Chart)

```sh
# Build Docker image
docker build -t gyre:latest .

# Install with Helm
helm install gyre charts/gyre --namespace flux-system --create-namespace

# Get admin password
kubectl get secret gyre-initial-admin-secret -n flux-system -o jsonpath='{.data.password}' | base64 -d

# Access via port-forward
kubectl port-forward -n flux-system svc/gyre 3000:80
```

**Architecture**: In-cluster-only deployment with ServiceAccount authentication. All Kubernetes API access uses the pod's ServiceAccount credentials.

### Database Management

```sh
bun drizzle-kit generate    # Generate migrations from schema changes
bun drizzle-kit migrate     # Run migrations (production runs auto on startup)
bun drizzle-kit studio      # Open database browser UI
```

**Database Location**: `./data/gyre.db` (development), `/data/gyre.db` (production container)

### Documentation Site

The project includes a Docusaurus documentation site at `entropy0120.github.io/gyre/`:

```sh
# Navigate to documentation folder
cd documentation

# Install dependencies (uses npm, not bun)
npm install

# Start documentation dev server
npm run start

# Build documentation
npm run build

# Serve built docs locally
npm run serve
```

**Important**: The documentation folder uses npm/package-lock.json (Docusaurus requirement), while the main app uses Bun. They don't interfere with each other. Documentation auto-deploys to GitHub Pages via `.github/workflows/docs-deploy.yml` on push to main.

### Release & Deployment

**Creating a Release:**

1. Update versions in `package.json` and `charts/gyre/Chart.yaml`
2. Commit changes
3. Create and push tag (triggers automated release workflow)

```sh
git add package.json charts/gyre/Chart.yaml
git commit -m "chore: bump version to v0.2.0"
git tag -a v0.2.0 -m "Release v0.2.0"
git push origin main --tags
```

## Development Conventions

### Svelte 5 Runes

Always use Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`). Do **not** use legacy Svelte 4 syntax (e.g., `export let`, `$:`).

### Functional Server Logic

Prefer functional modules and exports over class-based singletons. (e.g., see `src/lib/server/events.ts`).

### Multi-Cluster Context

Multi-cluster support is implemented via `locals.cluster`.

- Every API request carries a cluster context (defaulting to `in-cluster`).
- All Kubernetes client calls must `await` the asynchronous configuration loading and respect the provided context.

### Security & RBAC

- **Authentication**: Most API routes require a valid session via `locals.user`.
- **RBAC**: Use `checkPermission(user, action, resourceType, namespace, clusterId)` or `requirePermission` to enforce access control. Standardized across all `src/routes/api` endpoints.
- **Error Handling**: Use `throw error(status, message)` consistently in API routes.

### Git & Contribution

- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/).
- **Branches**: Use `type/description` naming (e.g., `feat/add-oidc-support`, `fix/rbac-bypass`).
- **Tests**: Automated testing is currently in the process of being established; testing is primarily manual in a real K8s environment for now.

## Important Implementation Notes

- **In-Cluster First**: Gyre is designed to run inside a Kubernetes cluster but supports local development via `~/.kube/config`.
- **Atomic Context Switching**: Avoid global variables for Kubernetes configuration. Always use the request-scoped `KubeConfig` instances managed by the client cache.

## Technical Implementation Details

### Resource Creation Wizard (Templates)

The `ResourceWizard` is a core component that allows users to create FluxCD resources through a multi-step form or direct YAML editing.

#### Wizard Configuration

Templates are defined in `src/lib/templates/index.ts`. Each `ResourceTemplate` includes:
- `id`: Unique identifier
- `title`: Display name
- `description`: Short summary
- `group`/`version`/`kind`: Kubernetes GVK
- `sections`: Logical grouping of fields
- `fields`: Individual form inputs with validation and help text

#### Key Field Properties:
- `path`: JSON path to the value in the manifest (e.g., `spec.interval`).
- `required`: Boolean or function for conditional requirements.
- `showIf`: Function to control field visibility based on other values.
- `validation`: Regex pattern for field validation (e.g., Durations: `^([0-9]+(\.[0-9]+)?(s|m|h))+$`).
- `referenceType`: Enable resource lookup in the wizard.

#### Bidirectional Sync
The `ResourceWizard` component manages the synchronization between the form state (`formValues`) and the raw YAML manifest using the `yaml` library's `parseDocument` and `setIn` methods to preserve comments.

### Monaco Editor Integration

The project uses Monaco Editor (VS Code's editor) for YAML/JSON editing throughout the application.

**Components:**
- `src/lib/components/editors/MonacoEditor.svelte` - Main Monaco wrapper component
- `src/lib/components/editors/YamlEditor.svelte` - Legacy simple editor (kept for fallback)

**Features:**
- Syntax highlighting for YAML and JSON
- Real-time validation with error markers
- Bidirectional value binding with `$bindable()`
- Theme synchronization with app theme (dark/light mode)
- Graceful fallback to textarea if Monaco fails to load

### SSO/OAuth Integration

The project includes full SSO support via Arctic and OIDC:
- **Providers supported**: GitHub, Google, Generic OIDC
- **Configuration**: Admin UI for provider setup (no restart required)
- **User flow**: Login → OAuth redirect → Callback → Auto-provision user

### WebSocket/SSE Notification System

The real-time notification system uses Server-Sent Events (SSE) located in `src/routes/api/ws/events/+server.ts` with client store at `src/lib/stores/websocket.svelte.ts`.

**Deduplication Strategy:**
- Track notification state: `{revision, readyStatus, readyReason, messagePreview}`
- Only trigger on meaningful changes (Revision change, Failure, Recovery)
- 30s settling period for `ADDED` events to avoid initial sync spam
- State persists in localStorage: `gyre_notifications` and `gyre_notification_state`

## Common Development Gotchas

1. **Server vs Client Code**: `$lib/server/` code ONLY runs server-side.
2. **Svelte 5 Runes**: Use `$state()`, `$derived()`, `$effect()`, `$props()`.
3. **Database Migrations**: Use `drizzle-kit generate` for schema changes.
4. **ServiceAccount Permissions**: Update `charts/gyre/templates/rbac.yaml` for new resources.
5. **Inventory System**: Check `src/lib/server/kubernetes/flux/inventory.ts` for resource relationships.
6. **Documentation Folder**: Uses npm (not Bun).
7. **Monaco Editor Lazy Loading**: Loaded via dynamic import. Always check `browser` environment.
