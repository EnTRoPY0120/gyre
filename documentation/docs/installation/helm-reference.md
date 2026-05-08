---
sidebar_position: 2
---

# Helm Chart Reference

This guide provides a detailed reference for all configuration options available in the Gyre Helm chart.

## Global Parameters

| Parameter          | Description                            | Default |
| ------------------ | -------------------------------------- | ------- |
| `nameOverride`     | Override chart name                    | `""`    |
| `fullnameOverride` | Override fully qualified app name      | `""`    |
| `origin`           | Explicit ORIGIN/BETTER_AUTH_URL value  | `""`    |
| `replicaCount`     | Number of replicas (SQLite requires 1) | `1`     |

## Image Configuration

| Parameter          | Description                                | Default                    |
| ------------------ | ------------------------------------------ | -------------------------- |
| `image.repository` | Container image repository                 | `ghcr.io/entropy0120/gyre` |
| `image.tag`        | Container image tag (overrides appVersion) | `""`                       |
| `image.pullPolicy` | Image pull policy                          | `IfNotPresent`             |
| `imagePullSecrets` | Image pull secrets                         | `[]`                       |

## Service Account

| Parameter                    | Description                                       | Default |
| ---------------------------- | ------------------------------------------------- | ------- |
| `serviceAccount.create`      | Create service account                            | `true`  |
| `serviceAccount.automount`   | Automount SA token for in-cluster Kubernetes auth | `true`  |
| `serviceAccount.annotations` | SA annotations                                    | `{}`    |
| `serviceAccount.name`        | SA name (generated if empty)                      | `""`    |

## Service Configuration

| Parameter            | Description             | Default     |
| -------------------- | ----------------------- | ----------- |
| `service.type`       | Kubernetes service type | `ClusterIP` |
| `service.port`       | Service port            | `80`        |
| `service.targetPort` | Container target port   | `3000`      |

## Ingress Configuration

| Parameter             | Description                 | Default         |
| --------------------- | --------------------------- | --------------- |
| `ingress.enabled`     | Enable ingress              | `false`         |
| `ingress.className`   | Ingress class name          | `""`            |
| `ingress.annotations` | Ingress annotations         | `{}`            |
| `ingress.hosts`       | Ingress hosts configuration | See values.yaml |
| `ingress.tls`         | Ingress TLS configuration   | `[]`            |

## Gateway API Configuration

| Parameter               | Description                                                                        | Default         |
| ----------------------- | ---------------------------------------------------------------------------------- | --------------- |
| `gatewayApi.enabled`    | Enable Gateway API HTTPRoute generation                                            | `false`         |
| `gatewayApi.parentRefs` | Gateway parent references                                                          | `[]`            |
| `gatewayApi.hostnames`  | Hostnames used for HTTPRoute matching and ORIGIN derivation when `origin` is unset | See values.yaml |
| `gatewayApi.tls`        | Treat derived ORIGIN/BETTER_AUTH_URL as `https://` when the Gateway terminates TLS | `false`         |
| `gatewayApi.rules`      | Optional HTTPRoute rule overrides                                                  | `[]`            |

## Persistence

| Parameter                   | Description                          | Default         |
| --------------------------- | ------------------------------------ | --------------- |
| `persistence.enabled`       | Enable persistent storage            | `true`          |
| `persistence.accessMode`    | PVC access mode                      | `ReadWriteOnce` |
| `persistence.size`          | PVC size                             | `1Gi`           |
| `persistence.storageClass`  | Storage class name (blank = default) | `""`            |
| `persistence.annotations`   | PVC annotations                      | `{}`            |
| `persistence.existingClaim` | Use existing PVC                     | `""`            |

## Security Context

| Parameter                                  | Description                | Default   |
| ------------------------------------------ | -------------------------- | --------- |
| `podSecurityContext.runAsNonRoot`          | Run as non-root            | `true`    |
| `podSecurityContext.runAsUser`             | User ID                    | `1001`    |
| `podSecurityContext.fsGroup`               | Filesystem group           | `1001`    |
| `securityContext.allowPrivilegeEscalation` | Allow privilege escalation | `false`   |
| `securityContext.capabilities.drop`        | Drop capabilities          | `["ALL"]` |
| `securityContext.readOnlyRootFilesystem`   | Read-only root FS          | `true`    |

## Resource Limits

| Parameter                   | Description    | Default |
| --------------------------- | -------------- | ------- |
| `resources.limits.cpu`      | CPU limit      | `500m`  |
| `resources.limits.memory`   | Memory limit   | `1Gi`   |
| `resources.requests.cpu`    | CPU request    | `100m`  |
| `resources.requests.memory` | Memory request | `128Mi` |

## Health Checks

| Parameter                            | Description   | Default |
| ------------------------------------ | ------------- | ------- |
| `livenessProbe.initialDelaySeconds`  | Initial delay | `30`    |
| `livenessProbe.periodSeconds`        | Check period  | `30`    |
| `readinessProbe.initialDelaySeconds` | Initial delay | `10`    |
| `readinessProbe.periodSeconds`       | Check period  | `10`    |

The default liveness probe uses `/api/v1/health`. The default readiness probe uses `/api/v1/ready`, which stays unavailable until Gyre initialization completes and remains unavailable after fatal startup failures.

## RBAC

| Parameter                 | Description           | Default |
| ------------------------- | --------------------- | ------- |
| `rbac.create`             | Create RBAC resources | `true`  |
| `rbac.clusterRole.create` | Create ClusterRole    | `true`  |
| `rbac.clusterRole.rules`  | Additional RBAC rules | `[]`    |

## Admin Configuration

| Parameter            | Description                  | Default                     |
| -------------------- | ---------------------------- | --------------------------- |
| `admin.autoGenerate` | Auto-generate admin password | `true`                      |
| `admin.secretName`   | Admin password secret name   | `gyre-initial-admin-secret` |

## Metrics & Monitoring

| Parameter                                 | Description                            | Default    |
| ----------------------------------------- | -------------------------------------- | ---------- |
| `metrics.enabled`                         | Enable application metrics             | `true`     |
| `metrics.existingSecret`                  | Secret containing `GYRE_METRICS_TOKEN` | `""`       |
| `metrics.serviceMonitor.enabled`          | Create a Prometheus ServiceMonitor     | `false`    |
| `metrics.serviceMonitor.interval`         | Scraping interval                      | `30s`      |
| `metrics.serviceMonitor.path`             | Metrics path                           | `/metrics` |
| `metrics.serviceMonitor.additionalLabels` | Additional labels for ServiceMonitor   | `{}`       |

## Network Policy

| Parameter                                          | Description                                                                    | Default      |
| -------------------------------------------------- | ------------------------------------------------------------------------------ | ------------ |
| `networkPolicy.enabled`                            | Enable NetworkPolicy                                                           | `true`       |
| `networkPolicy.apiServerNamespace`                 | Deprecated fallback namespace name for Kubernetes API egress (e.g., `default`) | `default`    |
| `networkPolicy.ingress.podSelector`                | Pod selector for ingress rules                                                 | `{}`         |
| `networkPolicy.ingress.namespaceSelector`          | Namespace selector for ingress rules                                           | `{}`         |
| `networkPolicy.ingress.additionalRules`            | Additional ingress rules                                                       | `[]`         |
| `networkPolicy.egress.apiServer.namespaceSelector` | Namespace selector for Kubernetes API egress targets                           | `{}`         |
| `networkPolicy.egress.apiServer.podSelector`       | Optional pod selector paired with the API-server namespace selector            | `{}`         |
| `networkPolicy.egress.apiServer.ipBlocks`          | CIDRs for managed control-plane API endpoints                                  | `[]`         |
| `networkPolicy.egress.apiServer.ports`             | Allowed TCP ports for Kubernetes API egress                                    | `[443,6443]` |
| `networkPolicy.egress.additionalRules`             | Additional egress rules                                                        | `[]`         |

`ORIGIN` and `BETTER_AUTH_URL` resolve in this order:

1. `origin` when non-empty
2. The first enabled ingress host
3. The first `gatewayApi.hostnames` entry, using `gatewayApi.tls` to choose `http` vs `https`
4. The in-cluster service URL fallback

## Application Configuration

| Parameter                    | Description                                                         | Default |
| ---------------------------- | ------------------------------------------------------------------- | ------- |
| `config.create`              | Create ConfigMap for app configuration                              | `true`  |
| `config.pollIntervalMs`      | Kubernetes API polling interval (ms)                                | `5000`  |
| `config.heartbeatIntervalMs` | SSE heartbeat interval (ms)                                         | `30000` |
| `config.dashboardCacheTtlMs` | Dashboard cache TTL (ms)                                            | `30000` |
| `config.settlingPeriodMs`    | Settling period for ADDED events (ms)                               | `30000` |
| `config.bodySizeLimit`       | Adapter request-body ceiling (`N`, `NK`, `NM`, `NG`, or `Infinity`) | `500M`  |
| `config.additionalConfig`    | Additional configuration key-value pairs                            | `{}`    |

Helm config keys map to these runtime env vars:

| Helm key                     | Environment variable            |
| ---------------------------- | ------------------------------- |
| `config.pollIntervalMs`      | `GYRE_POLL_INTERVAL_MS`         |
| `config.heartbeatIntervalMs` | `GYRE_HEARTBEAT_INTERVAL_MS`    |
| `config.dashboardCacheTtlMs` | `GYRE_DASHBOARD_CACHE_TTL_MS`   |
| `config.settlingPeriodMs`    | `GYRE_SETTLING_PERIOD_MS`       |
| `config.bodySizeLimit`       | `BODY_SIZE_LIMIT`               |
| `config.additionalConfig`    | Pass-through key/value env vars |

`config.additionalConfig` is rejected at render time when it contains chart-owned env vars. Reserved names include `DATABASE_URL`, `NODE_ENV`, `ORIGIN`, `BODY_SIZE_LIMIT`, polling/cache interval vars, encryption key vars, `GYRE_METRICS_TOKEN`, auth settings vars, `GYRE_AUTH_PROVIDERS`, and any `GYRE_AUTH_PROVIDER_*_CLIENT_SECRET` key. Use the matching chart value or secret setting instead.

## Encryption Configuration

| Parameter                     | Description                             | Default |
| ----------------------------- | --------------------------------------- | ------- |
| `encryption.gyreKey`          | Key for encrypting cluster kubeconfigs  | `""`    |
| `encryption.authKey`          | Key for encrypting OAuth client secrets | `""`    |
| `encryption.backupKey`        | Key for encrypting backup files         | `""`    |
| `encryption.betterAuthSecret` | Better Auth session signing secret      | `""`    |
| `encryption.existingSecret`   | Existing secret with encryption keys    | `""`    |

`encryption.existingSecret` must include all of:

- `GYRE_ENCRYPTION_KEY`
- `AUTH_ENCRYPTION_KEY`
- `BACKUP_ENCRYPTION_KEY`
- `BETTER_AUTH_SECRET`

## Auth Provider Secret Convention

`auth.providers` entries are metadata-only and must not include `clientSecret`.
When `auth.providers` is non-empty, `auth.providersExistingSecret` is required.
Each provider secret must use the provider-name convention shared by Helm and the runtime:

- Secret key format: `PROVIDER_<SANITIZED_PROVIDER_NAME>_CLIENT_SECRET`
- Env var format: `GYRE_AUTH_PROVIDER_<SANITIZED_PROVIDER_NAME>_CLIENT_SECRET`
- Sanitization: uppercase the provider name and replace every non-`[A-Z0-9]` character with `_`

Examples:

- `GitHub` -> `PROVIDER_GITHUB_CLIENT_SECRET`
- `Corporate SSO` -> `PROVIDER_CORPORATE_SSO_CLIENT_SECRET`
- `oauth2.generic` -> `PROVIDER_OAUTH2_GENERIC_CLIENT_SECRET`

## Upgrade Procedure

To upgrade Gyre:

```bash
# Update Helm repository
helm repo update

# Upgrade release
helm upgrade gyre oci://ghcr.io/entropy0120/charts/gyre \
  --namespace flux-system
```

### Upgrade with Backup

```bash
# 1. Backup database
POD=$(kubectl get pod -n flux-system -l app.kubernetes.io/name=gyre -o jsonpath='{.items[0].metadata.name}')
kubectl cp flux-system/$POD:/data/gyre.db ./gyre-backup-$(date +%Y%m%d).db

# 2. Perform upgrade
helm upgrade gyre oci://ghcr.io/entropy0120/charts/gyre --namespace flux-system

# 3. Verify
kubectl rollout status deployment/gyre -n flux-system
```

### Rollback

```bash
# View history
helm history gyre -n flux-system

# Rollback to previous version
helm rollback gyre -n flux-system

# Rollback to specific revision
helm rollback gyre 2 -n flux-system
```

## Troubleshooting

Common Helm installation issues:

### Pod Not Starting

**Symptoms**: Pod stuck in `Pending`, `CrashLoopBackOff`, or `ImagePullBackOff`

```bash
# Check pod status
kubectl get pods -n flux-system -l app.kubernetes.io/name=gyre

# Describe pod for events
kubectl describe pod -n flux-system -l app.kubernetes.io/name=gyre

# Check logs
kubectl logs -n flux-system -l app.kubernetes.io/name=gyre --tail=100
```

**Common Issues**:

- PVC not bound: Check `StorageClass` and `PV` availability.
- Image pull errors: Verify `image.repository` and `imagePullSecrets`.
- Insufficient resources: Check node capacity.

### Database Issues

**Check PVC status**:

```bash
kubectl get pvc -n flux-system
kubectl describe pvc gyre-data -n flux-system
```

### RBAC Permission Errors

**Test ServiceAccount permissions**:

```bash
# Check if SA can list FluxCD resources
kubectl auth can-i get gitrepositories.source.toolkit.fluxcd.io
  --as=system:serviceaccount:flux-system:gyre
  --all-namespaces
```

## Backup and Restore

### Automated Backup Script

```bash
#!/bin/bash
# backup-gyre.sh

NAMESPACE="flux-system"
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

POD=$(kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=gyre -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD" ]; then
  echo "Error: No Gyre pod found"
  exit 1
fi

echo "Backing up database from pod: $POD"
kubectl cp $NAMESPACE/$POD:/data/gyre.db $BACKUP_DIR/gyre-$DATE.db

echo "Backup completed: $BACKUP_DIR/gyre-$DATE.db"

# Keep only last 10 backups
ls -t $BACKUP_DIR/gyre-*.db | tail -n +11 | xargs -r rm
```

### Restore from Backup

```bash
#!/bin/bash
# restore-gyre.sh

NAMESPACE="flux-system"
BACKUP_FILE=$1
PVC_NAME="gyre-data" # Adjust if your PVC name is different

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file $BACKUP_FILE not found"
  exit 1
fi

# Scale down
echo "Scaling down Gyre deployment..."
kubectl scale deployment gyre -n $NAMESPACE --replicas=0
kubectl wait --for=delete pod -l app.kubernetes.io/name=gyre -n $NAMESPACE --timeout=60s

# Create helper pod to mount the PVC
echo "Creating restore helper pod..."
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: gyre-restore-helper
  namespace: $NAMESPACE
spec:
  containers:
  - name: helper
    image: alpine
    command: ["sleep", "3600"]
    volumeMounts:
    - name: data
      mountPath: /data
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: $PVC_NAME
EOF

kubectl wait --for=condition=ready pod gyre-restore-helper -n $NAMESPACE --timeout=60s

# Restore database
echo "Copying database file..."
kubectl cp $BACKUP_FILE $NAMESPACE/gyre-restore-helper:/data/gyre.db

# Cleanup helper
echo "Removing helper pod..."
kubectl delete pod gyre-restore-helper -n $NAMESPACE

# Scale up
echo "Scaling up Gyre deployment..."
kubectl scale deployment gyre -n $NAMESPACE --replicas=1
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=gyre -n $NAMESPACE --timeout=120s

echo "Database restored successfully from: $BACKUP_FILE"
```
