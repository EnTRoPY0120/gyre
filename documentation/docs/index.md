---
sidebar_position: 1
slug: /
---

# Gyre Documentation

Welcome to **Gyre** - A modern, full-featured WebUI for FluxCD.

## What is Gyre?

Gyre provides real-time monitoring, multi-cluster management, built-in RBAC, and comprehensive FluxCD resource management through an intuitive web interface.

### Key Features

🚀 **Real-time Updates** - Live resource monitoring via WebSocket
🎨 **Modern UI** - Built with SvelteKit and TailwindCSS
🔐 **Built-in Authentication** - Local and SSO/OAuth support
👥 **RBAC** - Fine-grained access control
🌐 **Multi-cluster** - Manage multiple Kubernetes clusters
📊 **Dashboard** - Customizable dashboards with widgets

## Quick Start

Get started with Gyre in minutes:

```bash
# Install via Helm
helm repo add gyre https://entropy0120.github.io/gyre
helm install gyre gyre/gyre \
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

## Support

- 💬 [GitHub Issues](https://github.com/entropy0120/gyre/issues)
- 📖 [GitHub Repository](https://github.com/entropy0120/gyre)

---

_Built with ❤️ for the FluxCD community_
