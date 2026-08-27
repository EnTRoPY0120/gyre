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
- 📊 **GitOps Toolkit Resources** - Manage all 13 supported resources, including Flux image automation

[See full feature list →](https://entropy0120.github.io/gyre/features)

---

## 🚀 Quick Start

Production deployments are Helm/GitOps-first and run in-cluster.
Local out-of-cluster usage is intended for development/testing.

### Option 1: GitOps (Using FluxCD)

The most natural way to install Gyre is by using Flux itself. Add this `HelmRelease` to your repository:

```yaml
---
apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
metadata:
  name: gyre
  namespace: flux-system
spec:
  interval: 1h
  url: oci://ghcr.io/entropy0120/charts/gyre
  ref:
    tag: 0.8.0-rc.2
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
helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
  --version 0.8.0-rc.2 \
  --namespace flux-system \
  --create-namespace
```

The chart generates the encryption and metrics Secrets on first install and retains them across upgrades and uninstall. For production, you can provide externally managed Secrets through `encryption.existingSecret` and `metrics.existingSecret`.

_Check the [latest release](https://github.com/entropy0120/gyre/releases/latest) for the current version._

### Option 3: Local Out-of-Cluster Testing (Docker)

Want to try the UI without installing it in your cluster? Run it locally connected to your `kubeconfig`:

```bash
# Run once per environment. Keep this file for future container recreations.
if [ ! -f .env.gyre ]; then
    (umask 077; {
        echo "AUTH_ENCRYPTION_KEY=$(openssl rand -hex 32)"
        echo "GYRE_ENCRYPTION_KEY=$(openssl rand -hex 32)"
        echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)"
        echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
        echo "GYRE_METRICS_TOKEN=$(openssl rand -hex 32)"
    } > .env.gyre)
fi

docker run \
    --env-file .env.gyre \
    -v gyre-data:/data \
    -v ~/.kube/config:/app/.kube/config:ro \
    -p 3000:3000 \
    ghcr.io/entropy0120/gyre:latest
```

_Note: Make sure your current context points to a valid cluster with Flux installed. The production image requires `GYRE_METRICS_TOKEN` to protect `/metrics`. Omit `ADMIN_PASSWORD` to let Gyre generate one, or set a strong password that satisfies the app password policy. Store `.env.gyre` securely and back it up with the `gyre-data` volume. Reuse it whenever you recreate the container; changing an encryption key can make stored data unreadable._

### Option 4: Local Demo Script

Don't have a cluster? Spin up a `kind` cluster with Flux and Gyre pre-installed in one command (required Helm secrets are generated automatically):

```bash
curl -sL https://raw.githubusercontent.com/entropy0120/gyre/main/scripts/demo.sh | bash
```

From a local checkout, run:

```bash
./scripts/demo.sh
```

### Development Container

For a standardized contributor environment, open the repository in VS Code with the Dev Containers extension and run **Dev Containers: Reopen in Container** from the command palette.

The container uses Node.js 22.13+, installs `pnpm@11.1.0`, includes Kubernetes tooling (`kubectl`, `helm`, `kind`, and `flux`), and runs `pnpm install --frozen-lockfile` from `.devcontainer/post-create.sh`.

Start the app inside the container with:

```bash
pnpm dev
```

Port `3000` is forwarded automatically. Your host kubeconfig is mounted read-only from `~/.kube` to `/home/node/.kube`, so you can use an existing cluster or manually create one with `kind` and install Flux when needed.

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
pnpm verify
pnpm verify:ci
pnpm docs:check
pnpm helm:check
pnpm scripts:check
pnpm verify:repo
pnpm verify:repo:ci
```

`verify` and `verify:ci` are app-only gates. `verify:repo` and `verify:repo:ci` are repo-wide gates.
Tests run through Vitest on Node.js with `pnpm test`.

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
