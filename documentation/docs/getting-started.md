---
sidebar_position: 2
---

# Getting Started

This guide will help you get Gyre up and running in your Kubernetes cluster.

Production installs are Helm/GitOps-first and in-cluster. Local out-of-cluster usage is for development/testing.

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

The standard way to install Gyre directly via Helm:

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

helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
  --version 0.6.0 \
  --namespace flux-system \
  --create-namespace \
  --set encryption.existingSecret=gyre-encryption \
  --set metrics.existingSecret=gyre-metrics
```

:::note
OCI Helm registries require an explicit version. Check the [latest release](https://github.com/entropy0120/gyre/releases/latest) for the current version number.
:::

### Option 3: Local Out-of-Cluster Testing (Docker)

If you want to try the UI without installing it inside your cluster, you can run it locally connected to your `kubeconfig`. Make sure your current Kubernetes context points to a cluster with Flux installed.

```bash
docker run \
    -e AUTH_ENCRYPTION_KEY=$(openssl rand -hex 32) \
    -e GYRE_ENCRYPTION_KEY=$(openssl rand -hex 32) \
    -e BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32) \
    -e BETTER_AUTH_SECRET=$(openssl rand -hex 32) \
    -v gyre-data:/data \
    -v ~/.kube/config:/app/.kube/config:ro \
    -p 3000:3000 \
    ghcr.io/entropy0120/gyre:latest
```

:::tip
Omit `ADMIN_PASSWORD` to let Gyre generate one, or provide a strong password that satisfies the app password policy. `BETTER_AUTH_SECRET` is the session secret and may be regenerated on each deploy if you accept invalidating active sessions. `GYRE_ENCRYPTION_KEY`, `AUTH_ENCRYPTION_KEY`, and `BACKUP_ENCRYPTION_KEY` are data-encryption keys: generate them once per environment, store them securely, and rotate them only with a migration plan to avoid making existing gyre-data unreadable.
:::

### Option 4: Local Demo Script

Don't have a cluster yet? Spin up a local `kind` cluster with Flux and Gyre pre-installed using our demo script (it creates required Helm secrets automatically):

```bash
curl -sL https://raw.githubusercontent.com/entropy0120/gyre/main/scripts/demo.sh | bash
```

If you are developing from a local checkout, prefer:

```bash
./scripts/demo.sh
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
