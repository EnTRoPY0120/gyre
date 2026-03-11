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
