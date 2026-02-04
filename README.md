# Gyre

**A Modern, High-Performance Dashboard for FluxCD.**

Gyre is a full-featured WebUI for managing multi-cluster FluxCD environments. Built with **Svelte 5**, **Bun**, and **SQLite**, it provides a real-time experience with built-in security, SSO integration, and comprehensive resource visualization.

## ✨ Key Features

- **🎨 Industrial Aesthetic**: A premium design featuring deep zinc backgrounds, high-contrast accents, and glassmorphic floating components.
- **🌐 Multi-Cluster Management**: Seamlessly switch between multiple Kubernetes clusters. Contexts are health-monitored in real-time with automatic reconciliation tracking.
- **📊 Inventory Architecture**: Hierarchical resource tree visualization showing the relationship between Flux resources and their downstream Kubernetes objects.
- **🔐 Enterprise Security**: Built-in RBAC (Admin, Editor, Viewer), OIDC/SSO support (GitHub, Google, etc.), and secure session management.
- **⚡ Comprehensive Control**: Full support for all FluxCD resources including Sources, Kustomizations, HelmReleases, Notifications, and Image Automations.
- **🚀 One-Click Actions**: Reconcile, Suspend, Resume, and Force-Sync resources directly from the UI with instant feedback via WebSockets.
- **📝 Audit Logging**: Complete audit trail for all user actions and system events stored in a highly-available SQLite backend.
- **💨 Multi-layer Caching**: Intelligent caching strategy (Server-side + API) to minimize Kubernetes API load while maintaining real-time responsiveness.

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh) (v1.1+)
- **Framework**: [Svelte 5](https://svelte.dev) (Runes) + SvelteKit
- **Styling**: TailwindCSS v4 + shadcn-svelte
- **Database**: SQLite with [Drizzle ORM](https://orm.drizzle.team)
- **API**: Native Kubernetes Client integration with WebSocket support
- **Auth**: [Arctic](https://arctic.js.org/) (OIDC) & [Jose](https://github.com/panva/jose) (JWT)

## 🏗️ Architecture

Gyre is designed for in-cluster deployment, leveraging ServiceAccounts for secure Kubernetes API access and a lightweight embedded database for state management.

## 🚀 Getting Started

### Prerequisites

- Kubernetes 1.25+ cluster
- FluxCD v2+ installed
- Helm 3.10+
- PersistentVolume provisioner

### Quick Installation

Install Gyre via Helm:

```bash
# Add the Gyre Helm repository
helm repo add gyre https://entropy0120.github.io/gyre
helm repo update

# Install the chart
helm install gyre gyre/gyre \
  --namespace flux-system \
  --create-namespace
```

### Get Admin Credentials

Retrieve the auto-generated admin password:

```bash
kubectl get secret gyre-initial-admin-secret -n flux-system \
  -o jsonpath='{.data.password}' | base64 -d
echo
```

### Accessing the Dashboard

**Option 1: Port-Forward (Local Access)**

```bash
kubectl port-forward -n flux-system svc/gyre 3000:80
```
Visit [http://localhost:3000](http://localhost:3000).

**Option 2: Ingress (Production)**

Configure your ingress settings in `values.yaml` or via `--set`:

```bash
helm upgrade --install gyre gyre/gyre -n flux-system \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=gyre.example.com
```

## 📈 Roadmap & Status

Gyre is under active development. Current focus is on advanced visualization and GitOps workflows.

- ✅ **Core Dashboard**: Real-time health and resource summaries.
- ✅ **Full Flux Support**: All Source, Kustomize, Helm, Notification, and Image Automations.
- ✅ **Multi-Cluster Support**: High-performance cluster switching and health monitoring.
- ✅ **SSO Integration**: OIDC support for major providers.
- ✅ **Inventory Tree**: Hierarchical visualization of resource relationships.
- ✅ **Audit System**: Detailed tracking of all administrative actions.
- 🔨 **Upcoming**: Advanced Diff Viewer, GitOps Commit management, and Performance Optimizations.

## 📜 License

Distributed under the MIT License. Developed with ❤️ by [Vijay](https://github.com/EnTRoPY0120).
