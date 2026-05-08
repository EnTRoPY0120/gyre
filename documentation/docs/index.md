---
sidebar_position: 1
slug: /
---

# Gyre Documentation

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
kubectl create namespace flux-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic gyre-encryption -n flux-system \
  --from-literal=GYRE_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=AUTH_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=BACKUP_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic gyre-metrics -n flux-system \
  --from-literal=GYRE_METRICS_TOKEN="$(openssl rand -hex 32)" \
  --dry-run=client -o yaml | kubectl apply -f -

# Install via Helm
helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
  --namespace flux-system \
  --create-namespace \
  --set encryption.existingSecret=gyre-encryption \
  --set metrics.existingSecret=gyre-metrics

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

- **Runtime:** [Bun](https://bun.sh) (v1.1+)
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
