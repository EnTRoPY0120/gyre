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
- ⚡ **Real-time Updates** - Live resource monitoring via SSE
- 📊 **Complete FluxCD Support** - All resource types supported

[See full feature list →](https://entropy0120.github.io/gyre/features)

---

## 🚀 Quick Start

Gyre can be installed in several ways depending on your workflow:

### Option 1: GitOps (Using FluxCD)

The most natural way to install Gyre is by using Flux itself. Add this `HelmRelease` to your repository:

```yaml
---
apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: gyre
  namespace: flux-system
spec:
  interval: 1h
  url: https://entropy0120.github.io/gyre
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: gyre
  namespace: flux-system
spec:
  interval: 1h
  chart:
    spec:
      chart: gyre
      version: '>=0.1.0'
      sourceRef:
        kind: HelmRepository
        name: gyre
```

### Option 2: Helm

```bash
# Add the Gyre Helm repository
helm repo add gyre https://entropy0120.github.io/gyre
helm repo update

# Install Gyre
helm install gyre gyre/gyre \
  --namespace flux-system \
  --create-namespace
```

### Option 3: Local Out-of-Cluster Testing (Docker)

Want to try the UI without installing it in your cluster? Run it locally connected to your `kubeconfig`:

```bash
docker run -d \
  --name gyre \
  -p 3000:3000 \
  -v ~/.kube/config:/root/.kube/config:ro \
  ghcr.io/entropy0120/gyre:latest
```

_Note: Make sure your current context points to a valid cluster with Flux installed._

### Option 4: Local Demo Script

Don't have a cluster? Spin up a `kind` cluster with Flux and Gyre pre-installed in one command:

```bash
curl -sL https://raw.githubusercontent.com/entropy0120/gyre/main/scripts/demo.sh | bash
```

### Get Admin Credentials (for in-cluster installs)

```bash
kubectl get secret gyre-initial-admin-secret -n flux-system \
  -o jsonpath='{.data.password}' | base64 -d && echo
```

Visit [http://localhost:3000](http://localhost:3000) after port-forwarding with:

```bash
kubectl port-forward -n flux-system svc/gyre 3000:80
```

and login with `admin` and the password from above.

---

## 📚 Documentation

Comprehensive documentation is available at **[entropy0120.github.io/gyre](https://entropy0120.github.io/gyre/)**:

- **[Getting Started](https://entropy0120.github.io/gyre/getting-started)** - Installation guide and first steps
- **[Architecture](https://entropy0120.github.io/gyre/architecture)** - System design and components
- **[Configuration](https://entropy0120.github.io/gyre/configuration)** - Customization options
- **[Features](https://entropy0120.github.io/gyre/features)** - Complete feature overview
- **[Contributing](https://entropy0120.github.io/gyre/contributing)** - How to contribute
- **[Development](https://entropy0120.github.io/gyre/development)** - Technical development guide
- **[API Reference](https://entropy0120.github.io/gyre/api/)** - API documentation

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

---

<p align="center">
  Built with ❤️ for the FluxCD community
</p>
