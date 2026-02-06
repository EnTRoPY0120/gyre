# Gyre

[![Documentation](https://img.shields.io/badge/docs-entropy0120.github.io%2Fgyre-gold?style=for-the-badge)](https://entropy0120.github.io/gyre/)
[![GitHub release](https://img.shields.io/github/v/release/entropy0120/gyre?style=for-the-badge)](https://github.com/entropy0120/gyre/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

> **A Modern WebUI for FluxCD** with real-time monitoring, multi-cluster management, and built-in RBAC.

[📚 **Full Documentation**](https://entropy0120.github.io/gyre/) •
[🚀 **Quick Start**](https://entropy0120.github.io/gyre/getting-started) •
[💻 **GitHub**](https://github.com/entropy0120/gyre)

---

## ✨ Features

- 🎨 **Modern UI** - Built with Svelte 5 and TailwindCSS
- 🌐 **Multi-Cluster** - Manage multiple Kubernetes clusters
- 🔐 **Built-in Security** - RBAC and SSO/OAuth support
- ⚡ **Real-time Updates** - Live resource monitoring via WebSocket
- 📊 **Complete FluxCD Support** - All resource types supported

[See full feature list →](https://entropy0120.github.io/gyre/features)

---

## 🚀 Quick Start

### Prerequisites

- Kubernetes 1.25+ cluster
- FluxCD v2+ installed
- Helm 3.10+

### Installation

```bash
# Add the Gyre Helm repository
helm repo add gyre https://entropy0120.github.io/gyre
helm repo update

# Install Gyre
helm install gyre gyre/gyre \
  --namespace flux-system \
  --create-namespace
```

### Get Admin Credentials

```bash
kubectl get secret gyre-initial-admin-secret -n flux-system \
  -o jsonpath='{.data.password}' | base64 -d && echo
```

### Access the Dashboard

```bash
# Port-forward for local access
kubectl port-forward -n flux-system svc/gyre 3000:80
```

Visit [http://localhost:3000](http://localhost:3000) and login with:

- **Username:** `admin`
- **Password:** (from command above)

---

## 🏗️ Development

### Using DevContainer (Recommended)

The easiest way to start developing Gyre is to use the provided devcontainer:

1. Open the repository in [VS Code](https://code.visualstudio.com/)
2. Install the [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers)
3. Press `F1` and select "Dev Containers: Reopen in Container"
4. The devcontainer will automatically:
   - Install [Bun](https://bun.sh) runtime
   - Install VS Code extensions (Svelte, Tailwind, Kubernetes)
   - Mount your `~/.kube` config for cluster access
   - Run `bun install` and type checks

**Optional: Create a local kind cluster with FluxCD**

```bash
# Create kind cluster (requires Docker)
kind create cluster

# Install FluxCD
flux install

# Verify FluxCD is running
kubectl get pods -n flux-system
```

**Start the development server:**

```bash
bun run dev
```

Access Gyre at [http://localhost:3000](http://localhost:3000)

### Manual Setup

If you prefer not to use the devcontainer:

1. Install [Bun](https://bun.sh) (v1.1+)
2. Install dependencies: `bun install`
3. Start development server: `bun run dev`

---

## 📚 Documentation

Comprehensive documentation is available at **[entropy0120.github.io/gyre](https://entropy0120.github.io/gyre/)**:

- **[Getting Started](https://entropy0120.github.io/gyre/getting-started)** - Installation guide and first steps
- **[Architecture](https://entropy0120.github.io/gyre/architecture)** - System design and components
- **[Configuration](https://entropy0120.github.io/gyre/configuration)** - Customization options
- **[Features](https://entropy0120.github.io/gyre/features)** - Complete feature overview
- **[Contributing](https://entropy0120.github.io/gyre/contributing)** - How to contribute
- **[API Reference](https://entropy0120.github.io/gyre/api/)** - API documentation

---

## 🛠️ Tech Stack

- **Runtime:** [Bun](https://bun.sh) (v1.1+)
- **Framework:** [Svelte 5](https://svelte.dev) + SvelteKit
- **Styling:** TailwindCSS v4 + shadcn-svelte
- **Database:** SQLite with [Drizzle ORM](https://orm.drizzle.team)
- **Kubernetes:** Native client with WebSocket support

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://entropy0120.github.io/gyre/contributing) for details.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

<p align="center">
  Built with ❤️ for the FluxCD community
</p>
