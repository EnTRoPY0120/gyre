# Gyre

**A Modern, Enterprise-Grade Dashboard for FluxCD.**

Gyre is a full-featured WebUI for managing multi-cluster FluxCD environments. Built with **Svelte 5**, **Bun**, and **SQLite**, it provides a real-time, high-performance experience with built-in security and multi-cluster support.

## ✨ Key Features

- **🎨 Blacksmith Aesthetic**: A premium "industrial" design featuring deep zinc backgrounds (`#09090b`), "Forged Gold" (`#F59E0B`) accents, and glassmorphic floating components.
- **🌐 Multi-Cluster Management**: Seamlessly switch between multiple Kubernetes clusters using a premium switcher. Contexts are health-monitored in real-time.
- **📊 Live Status**: Real-time "glowing" status indicators and live reconciliation feedback via WebSockets.
- **🔐 Authentication & RBAC**: Built-in user management with role-based access control (Admin, Editor, Viewer) and fine-grained permissions.
- **⚡ All FluxCD Resources**: Comprehensive UI for every Source, Kustomize, Helm, Notification, and Image Automation controller resource.
- **🚀 Resource Actions**: Suspend, resume, reconcile, and force-reconcile resources with a single click.
- **📝 Audit Logging**: Complete audit trail for all user actions and system events stored in SQLite.
- **💨 Multi-layer Caching**: Optimized server-side and API caching to minimize Kubernetes API load.

## 🛠️ Tech Stack

- **Runtime**: [Bun](https://bun.sh) (v1.x) / Node.js
- **Framework**: SvelteKit + Svelte 5 (Runes)
- **Styling**: TailwindCSS v4 + shadcn-svelte
- **Database**: SQLite with Drizzle ORM
- **API**: @kubernetes/client-node (Native K8s integration)
- **Real-time**: WebSockets (Kubernetes Watch API)

## 🏗️ Architecture

Gyre runs as a standard Node.js application (via SvelteKit's adapter-node) with an embedded SQLite database.

```mermaid
graph LR
    User[User / Ops] -->|HTTPS| Gyre[Gyre Server]
    Gyre -->|SQLite| DB[(Local DB)]
    Gyre -->|K8s API| Cluster1[Cluster A (Dev)]
    Gyre -->|K8s API| Cluster2[Cluster B (Prod)]

    subgraph Gyre Internal
        UI[Svelte 5 UI] <--> WS[WebSockets]
        UI <--SSR--> API[Server API]
        API -->|Drizzle| DB
        API -->|K8s Client| Clusters
    end
```

## 🚀 Getting Started

### Prerequisites

- Kubernetes 1.20+ cluster with FluxCD v2+ installed
- Helm 3.0+
- PersistentVolume provisioner support

### Quick Installation

Install Gyre in your Kubernetes cluster using Helm:

```bash
# Add Helm repository (if published)
# helm repo add gyre https://username.github.io/gyre
# helm repo update

# Install from local chart
helm install gyre charts/gyre \
  --namespace flux-system \
  --create-namespace
```

### Get Admin Credentials

After installation, retrieve the auto-generated admin password:

```bash
kubectl get secret gyre-initial-admin-secret -n flux-system \
  -o jsonpath='{.data.password}' | base64 -d
echo
```

### Access Gyre

**Option 1: Port Forward (Quick Access)**

```bash
kubectl port-forward -n flux-system svc/gyre 3000:80
```

Then visit http://localhost:3000

**Option 2: Ingress (Production)**

```bash
helm install gyre charts/gyre \
  --namespace flux-system \
  --create-namespace \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=gyre.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

Then visit https://gyre.example.com

### Development

For local development:

```bash
# Install dependencies
bun install

# Run database migrations
bun drizzle-kit migrate

# Start the dev server
bun run dev
```

**Note:** Gyre is designed for in-cluster deployment only. Local development mode is supported but requires kubeconfig access.

## 📈 Implementation Status

Gyre is currently in **Phase 22**.

- ✅ Dashboard & Overview
- ✅ All FluxCD Resource Types (Source, Kustomize, Helm, Notification, Image)
- ✅ Multi-Cluster Support
- ✅ Authentication & RBAC
- ✅ Real-time WebSocket Updates
- ✅ Audit Logging & Event Streaming
- ✅ Multi-layer Caching
- 🔨 **Current Focus**: Inventory & Resource Tree Visualization (Hierarchical relationships)

## 📜 License

MIT License. Built with ❤️ by [Vijay](https://github.com/EnTRoPY0120).
