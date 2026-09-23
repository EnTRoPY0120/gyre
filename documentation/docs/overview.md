---
sidebar_position: 1
slug: /overview
---

# Overview

Welcome to **Gyre** - A modern, full-featured WebUI for FluxCD.

## What is Gyre?

Gyre provides real-time monitoring, multi-cluster management, built-in RBAC, and comprehensive FluxCD resource management through an intuitive web interface.

Production usage is Helm/GitOps-first and in-cluster. Out-of-cluster mode is supported for local development/testing.

### Key Features

🚀 **Real-time Updates** - Live resource monitoring via SSE
🎨 **Modern UI** - Built with SvelteKit and TailwindCSS
🔐 **Built-in Authentication** - Local login plus GitHub, Google, GitLab, and generic OIDC/OAuth2
👥 **RBAC** - Fine-grained access control
🌐 **Multi-cluster** - Manage multiple Kubernetes clusters
📊 **Dashboard** - Built-in overview cards for cluster health and Flux resource status

## Quick Start

Get started with Gyre in minutes:

```bash
# Install via Helm. The chart generates the required encryption and metrics Secrets.
helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
  --version 0.7.0 \
  --namespace flux-system \
  --create-namespace

# Get admin password
kubectl get secret gyre-initial-admin-secret \
  -n flux-system \
  -o jsonpath='{.data.password}' | base64 -d

# Access via port-forward
kubectl port-forward -n flux-system svc/gyre 3000:80
```

Then open http://localhost:3000 in your browser.

## Documentation Sections

- **[Getting Started](/getting-started)** - Installation and first steps
- **[User Guides](/user-guide/resource-wizard)** - How to use Gyre effectively
  - [Resource Creation Wizard](/user-guide/resource-wizard)
- **[Installation](/installation)** - Detailed installation options
- **[Configuration](/configuration)** - Configure Gyre for your needs
- **[Architecture](/architecture)** - Understand how Gyre works
- **[Features](/features)** - Explore all features
- **[API Reference](/api)** - API documentation
- **[Contributing](/contributing)** - How to contribute

## 🛠️ Tech Stack

- **Package Manager:** [pnpm](https://pnpm.io) 11.1.0
- **Test Runner:** [Vitest](https://vitest.dev) on Node.js
- **Framework:** [Svelte 5](https://svelte.dev) + SvelteKit
- **Styling:** TailwindCSS v4 + shadcn-svelte
- **Database:** SQLite with [Drizzle ORM](https://orm.drizzle.team)
- **Kubernetes:** Native client with SSE-based real-time updates

## 📄 License

Distributed under the MIT License. See [LICENSE](https://github.com/entropy0120/gyre/blob/main/LICENSE) for more information.

## Support

- 💬 [GitHub Issues](https://github.com/entropy0120/gyre/issues)
- 📖 [GitHub Repository](https://github.com/entropy0120/gyre)

---

_Built with ❤️ for the FluxCD community_
