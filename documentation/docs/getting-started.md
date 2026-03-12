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

Gyre can be installed in several ways depending on your workflow.

### Option 1: GitOps (Using FluxCD)

The most natural way to install Gyre is by using Flux itself. Add this `HelmRelease` to your GitOps repository:

```yaml
---
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: HelmRepository
metadata:
  name: gyre
  namespace: flux-system
spec:
  interval: 1h
  url: https://entropy0120.github.io/gyre
---
apiVersion: helm.toolkit.fluxcd.io/v2beta2
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

The standard way to install Gyre directly via Helm:

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

If you want to try the UI without installing it inside your cluster, you can run it locally connected to your `kubeconfig`. Make sure your current Kubernetes context points to a cluster with Flux installed.

```bash
docker run -d \
  --name gyre \
  -p 3000:3000 \
  -v ~/.kube/config:/root/.kube/config:ro \
  ghcr.io/entropy0120/gyre:latest
```

### Option 4: Local Demo Script

Don't have a cluster yet? Spin up a local `kind` cluster with Flux and Gyre pre-installed using our demo script:

```bash
curl -sL https://raw.githubusercontent.com/entropy0120/gyre/main/scripts/demo.sh | bash
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
