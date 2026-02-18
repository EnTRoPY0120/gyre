---
sidebar_position: 2
---

# Getting Started

This guide will help you get Gyre up and running in your Kubernetes cluster.

## Prerequisites

Before you begin, ensure you have:

- Kubernetes cluster (1.24+)
- Helm 3.x installed
- FluxCD installed in your cluster
- kubectl configured to access your cluster

## Installation

### Option 1: Helm (Recommended)

The easiest way to install Gyre is via Helm:

```bash
# Add the Gyre Helm repository
helm repo add gyre https://entropy0120.github.io/gyre
helm repo update

# Install Gyre
helm install gyre gyre/gyre \
  --namespace flux-system \
  --create-namespace
```

### Option 2: kubectl

You can also install using kubectl:

```bash
kubectl apply -f https://github.com/entropy0120/gyre/releases/latest/download/install.yaml
```

## Accessing Gyre

### Port Forward (Development)

```bash
kubectl port-forward -n flux-system svc/gyre 3000:80
```

Then open http://localhost:3000

### Production Access (Ingress / LoadBalancer)

For production deployments, you should use an Ingress Controller or a LoadBalancer service. See the [Production Access & Ingress Guide](/installation/production-access) for detailed configuration examples for Nginx, Traefik, and more.

## First Login

1. Get the initial admin password:

   ```bash
   kubectl get secret gyre-initial-admin-secret \
     -n flux-system \
     -o jsonpath='{.data.password}' | base64 -d
   ```

2. Open Gyre in your browser
3. Login with:
   - **Username**: admin
   - **Password**: (from step 1)

4. Change the password immediately after first login

## Next Steps

- [Configure Gyre](/configuration)
- [Explore features](/features)
- [Read the architecture guide](/architecture)

## Troubleshooting

If you encounter issues:

1. Check pod status:

   ```bash
   kubectl get pods -n flux-system -l app.kubernetes.io/name=gyre
   ```

2. View logs:

   ```bash
   kubectl logs -n flux-system -l app.kubernetes.io/name=gyre
   ```

3. Check our [Troubleshooting guide](/troubleshooting)
