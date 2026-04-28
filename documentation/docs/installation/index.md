---
sidebar_position: 3
---

# Installation

Gyre can be installed in several ways depending on your environment and requirements.

:::tip
For production environments, please refer to the [Production Access & Ingress Guide](./production-access.md) for detailed configuration examples.
:::

## Option 1: GitOps (Using FluxCD)

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
  values:
    # Any custom configuration values here
```

## Option 2: Helm Installation

Helm is the standard way to install Gyre directly, as it provides easy configuration and upgrades.

### Basic Installation

```bash
helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
  --version 0.6.0 \
  --namespace flux-system \
  --create-namespace
```

:::note
OCI Helm registries require an explicit version. Check the [latest release](https://github.com/entropy0120/gyre/releases/latest) for the current version number.
:::

For more detailed configuration options, see the [Helm Chart Reference](./helm-reference.md).

### Custom Configuration

Create a `values.yaml` file:

```yaml
# values.yaml
image:
  repository: ghcr.io/entropy0120/gyre
  tag: latest
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: gyre.example.com
      paths:
        - path: /
          pathType: Prefix

resources:
  limits:
    cpu: 1000m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

persistence:
  enabled: true
  size: 1Gi
```

Install with custom values:

```bash
helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
  --namespace flux-system \
  --create-namespace \
  -f values.yaml
```

## Option 3: Local Out-of-Cluster Testing (Docker)

If you want to try the UI without installing it inside your cluster, you can run it locally connected to your `kubeconfig`. Make sure your current Kubernetes context points to a cluster with Flux installed.

```bash
docker run \
    -e AUTH_ENCRYPTION_KEY=$(openssl rand -hex 32) \
    -e GYRE_ENCRYPTION_KEY=$(openssl rand -hex 32) \
    -e ADMIN_PASSWORD=admin123 \
    -v gyre-data:/data \
    -v ~/.kube/config:/app/.kube/config:ro \
    -p 3000:3000 \
    ghcr.io/entropy0120/gyre:latest
```

:::tip
Change `ADMIN_PASSWORD` to a strong password before use. The `AUTH_ENCRYPTION_KEY` and `GYRE_ENCRYPTION_KEY` values are used to encrypt session data and secrets — regenerate them with `openssl rand -hex 32` each time you deploy.
:::

## Option 4: Local Demo Script

Don't have a cluster yet? Spin up a local `kind` cluster with Flux and Gyre pre-installed using our demo script:

```bash
curl -sL https://raw.githubusercontent.com/entropy0120/gyre/main/scripts/demo.sh | bash
```

## Configuration Options

### Database

Gyre uses SQLite by default. For production, configure persistence:

```yaml
persistence:
  enabled: true
  storageClass: standard
  size: 5Gi
  accessMode: ReadWriteOnce
```

### Authentication

Enable SSO/OAuth:

```yaml
auth:
  providers:
    - name: GitHub
      type: oauth2-github
      clientId: 'your-client-id'
  providersExistingSecret: gyre-auth-provider-secrets
```

Provider objects are metadata-only. Store provider secrets in the referenced secret
using keys like `PROVIDER_GITHUB_CLIENT_SECRET`.

### Resources

Adjust resource limits:

```yaml
resources:
  limits:
    cpu: 2000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 256Mi
```

## Verification

Check the installation:

```bash
# Check pod status
kubectl get pods -n flux-system -l app.kubernetes.io/name=gyre

# Check service
kubectl get svc -n flux-system gyre

# View logs
kubectl logs -n flux-system -l app.kubernetes.io/name=gyre
```

## Upgrading

To upgrade Gyre:

```bash
helm upgrade gyre oci://ghcr.io/entropy0120/charts/gyre \
  --version 0.6.0 \
  --namespace flux-system
```

## Uninstallation

To remove Gyre:

```bash
helm uninstall gyre --namespace flux-system
```

**Note:** This will not delete the PersistentVolumeClaim. To remove all data:

```bash
kubectl delete pvc -n flux-system -l app.kubernetes.io/name=gyre
```
