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
- 🔐 **Built-in Security** - RBAC plus local login, GitHub, Google, GitLab, and generic OIDC/OAuth2 auth support
- ⚡ **Real-time Updates** - Live resource monitoring via SSE
- 📊 **Complete FluxCD Support** - All resource types supported

[See full feature list →](https://entropy0120.github.io/gyre/features)

---

## 🚀 Quick Start

Production deployments are Helm/GitOps-first and run in-cluster.
Local out-of-cluster usage is intended for development/testing.

### Option 1: GitOps (Using FluxCD)

The most natural way to install Gyre is by using Flux itself. Add this `HelmRelease` to your repository:

```yaml
---
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata:
  name: gyre
  namespace: flux-system
spec:
  interval: 1h
  url: oci://ghcr.io/entropy0120/charts/gyre
  ref:
    semver: '>=0.6.0'
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: gyre
  namespace: flux-system
spec:
  interval: 1h
  chartRef:
    kind: OCIRepository
    name: gyre
    namespace: flux-system
```

### Option 2: Helm

```bash
kubectl create namespace flux-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic gyre-encryption -n flux-system \
  --from-literal=GYRE_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=AUTH_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=BACKUP_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic gyre-metrics -n flux-system \
  --from-literal=GYRE_METRICS_TOKEN="$(openssl rand -hex 32)" \
  --dry-run=client -o yaml | kubectl apply -f -

helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
  --version 0.6.0 \
  --namespace flux-system \
  --create-namespace \
  --set encryption.existingSecret=gyre-encryption \
  --set metrics.existingSecret=gyre-metrics
```

_Check the [latest release](https://github.com/entropy0120/gyre/releases/latest) for the current version._

### Option 3: Local Out-of-Cluster Testing (Docker)

Want to try the UI without installing it in your cluster? Run it locally connected to your `kubeconfig`:

```bash
docker run \
    -e AUTH_ENCRYPTION_KEY=$(openssl rand -hex 32) \
    -e GYRE_ENCRYPTION_KEY=$(openssl rand -hex 32) \
    -e BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32) \
    -e ADMIN_PASSWORD=admin123 \
    -v gyre-data:/data \
    -v ~/.kube/config:/app/.kube/config:ro \
    -p 3000:3000 \
    ghcr.io/entropy0120/gyre:latest
```

_Note: Make sure your current context points to a valid cluster with Flux installed. Change `ADMIN_PASSWORD` to a strong password before use._

### Option 4: Local Demo Script

Don't have a cluster? Spin up a `kind` cluster with Flux and Gyre pre-installed in one command (required Helm secrets are generated automatically):

```bash
curl -sL https://raw.githubusercontent.com/entropy0120/gyre/main/scripts/demo.sh | bash
```

From a local checkout, run:

```bash
./scripts/demo.sh
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

## ✅ Verification

```bash
bun run verify
bun run verify:ci
bun run docs:check
bun run helm:check
bun run scripts:check
bun run verify:repo
bun run verify:repo:ci
```

`verify` and `verify:ci` are app-only gates. `verify:repo` and `verify:repo:ci` are repo-wide gates.

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
