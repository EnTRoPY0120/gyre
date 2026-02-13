# Gyre - Instructional Context

Gyre is a modern, real-time WebUI for **FluxCD**, designed to manage multiple Kubernetes clusters with built-in RBAC and SSO support.

## 🛠 Tech Stack

- **Runtime:** [Bun](https://bun.sh)
- **Framework:** [Svelte 5](https://svelte.dev) + [SvelteKit](https://kit.svelte.dev)
- **Styling:** TailwindCSS v4 + shadcn-svelte
- **Database:** SQLite with [Drizzle ORM](https://orm.drizzle.team)
- **Kubernetes:** Native `@kubernetes/client-node` with multi-cluster context support
- **Real-time:** Server-Sent Events (SSE) via a consolidated background polling worker

## 🏗 Architecture & Project Structure

The project follows standard SvelteKit conventions with a strong emphasis on multi-cluster isolation and security.

- `src/lib/server/`: **Server-only code**. Contains database schema, authentication logic, RBAC enforcement, and Kubernetes client wrappers.
  - `kubernetes/`: Handles cluster configuration, API client generation, and resource fetching.
  - `events.ts`: Functional event bus that manages per-cluster polling loops for SSE subscribers.
- `src/lib/components/`: Reusable UI components.
  - `flux/`: Specialized components for FluxCD resources (GitRepository, Kustomization, etc.).
- `src/lib/stores/`: Svelte 5 runes-based stores for client-side state management.
- `src/routes/`: SvelteKit pages and API endpoints.
  - `api/`: All destructive operations (POST/PATCH/DELETE) and protected data fetches.
- `charts/gyre/`: Helm chart for production deployment.
- `documentation/`: Docusaurus-based documentation site.

## 🚀 Key Commands

### Development

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Type-check
bun run check

# Lint and format
bun run lint
bun run format
```

### Production

```bash
# Build for production (Node adapter)
bun run build

# Preview build
bun run preview
```

## 📜 Development Conventions

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

## ⚠️ Important Implementation Notes

- **In-Cluster First**: Gyre is designed to run inside a Kubernetes cluster but supports local development via `~/.kube/config`.
- **Atomic Context Switching**: Avoid global variables for Kubernetes configuration. Always use the request-scoped `KubeConfig` instances managed by the client cache.
