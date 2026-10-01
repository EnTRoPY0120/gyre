---
sidebar_position: 3
---

# Installation

Production deployments run in-cluster. The Helm chart creates and retains encryption and metrics Secrets on first install. Keep these Secrets and persistent data across upgrades; changing encryption keys can make stored data unreadable. For production environments with managed secrets, configure `encryption.existingSecret` and `metrics.existingSecret`.

The example pins a chart version for reproducible installs. Check the [latest release](https://github.com/entropy0120/gyre/releases/latest) and update the version as needed.

## Helm

```sh
helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
  --version 0.7.1 \
  --namespace flux-system \
  --create-namespace
```

Use `helm upgrade` for subsequent chart updates. See the [Helm reference](./helm-reference.md) for values and the [production access guide](./production-access.md) for ingress and load balancers.

For clusters that enforce NetworkPolicy, configure `networkPolicy.egress.apiServer` to match the API endpoint and allow the intended UI ingress through `networkPolicy.ingress`. Host-network or external API servers may need endpoint CIDRs in `networkPolicy.egress.apiServer.ipBlocks`.

## Flux GitOps

Add an `OCIRepository` and `HelmRelease` to the repository Flux reconciles. Set `ref.tag` to the release version:

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
metadata:
  name: gyre
  namespace: flux-system
spec:
  interval: 1h
  url: oci://ghcr.io/entropy0120/charts/gyre
  ref:
    tag: 0.7.1
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

## Local development and demos

For app development, use the [Development Guide](../development.md). To try Gyre against an existing cluster in Docker, use a flattened temporary kubeconfig copy so the container's non-root user can read it without changing the original file permissions:

```sh
# Create once and keep for container recreations.
if [ ! -f .env.gyre ]; then
  (umask 077; {
    echo "AUTH_ENCRYPTION_KEY=$(openssl rand -hex 32)"
    echo "GYRE_ENCRYPTION_KEY=$(openssl rand -hex 32)"
    echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)"
    echo "BETTER_AUTH_SECRET=$(openssl rand -hex 32)"
    echo "GYRE_METRICS_TOKEN=$(openssl rand -hex 32)"
  } > .env.gyre)
fi

(
  set -e
  kubeconfig_dir="$(mktemp -d)"
  chmod 700 "$kubeconfig_dir"
  cleanup_kubeconfig() {
    rm -f "$kubeconfig_dir/config"
    rmdir "$kubeconfig_dir"
  }
  trap cleanup_kubeconfig EXIT
  kubectl config view --raw --flatten --minify > "$kubeconfig_dir/config"
  chmod 644 "$kubeconfig_dir/config"
  docker run --rm \
    --env-file .env.gyre \
    -v gyre-data:/data \
    -v "$kubeconfig_dir/config:/app/.kube/config:ro" \
    -p 3000:3000 \
    ghcr.io/entropy0120/gyre:latest
)
```

This example includes only the current Kubernetes context. For multiple clusters, set `KUBECONFIG` to a dedicated file containing only the contexts Gyre should manage and omit `--minify`.

The production image requires `GYRE_METRICS_TOKEN`. Store `.env.gyre` and the `gyre-data` volume securely, reuse them when recreating the container, and ensure the Kubernetes API address is reachable from Docker. Changing encryption keys can make existing data unreadable.

To create a disposable `kind` cluster with Flux and Gyre, use the [demo script](https://github.com/entropy0120/gyre/blob/main/scripts/demo.sh):

```sh
curl -sL https://raw.githubusercontent.com/entropy0120/gyre/main/scripts/demo.sh | bash
```

## Verify and access

Check pod status, then retrieve the initial admin password and port-forward the service:

```sh
kubectl get pods -n flux-system -l app.kubernetes.io/name=gyre
kubectl get secret "${GYRE_ADMIN_SECRET_NAME:-gyre-initial-admin-secret}" -n flux-system \
  -o jsonpath='{.data.password}' | base64 -d && echo
kubectl port-forward -n flux-system svc/gyre 3000:80
```

Open http://localhost:3000 and sign in as `admin`. Set `admin.secretName` in Helm values when using a custom admin Secret name; the chart passes it to Gyre as `GYRE_ADMIN_SECRET_NAME`. Set the same variable in your local shell when running the `kubectl get secret` command above.
