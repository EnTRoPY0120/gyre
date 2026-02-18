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
| `replicaCount`     | Number of replicas (SQLite requires 1) | `1`     |

## Image Configuration

| Parameter          | Description                                | Default                    |
| ------------------ | ------------------------------------------ | -------------------------- |
| `image.repository` | Container image repository                 | `ghcr.io/entropy0120/gyre` |
| `image.tag`        | Container image tag (overrides appVersion) | `""`                       |
| `image.pullPolicy` | Image pull policy                          | `IfNotPresent`             |
| `imagePullSecrets` | Image pull secrets                         | `[]`                       |

## Service Account

| Parameter                    | Description                  | Default |
| ---------------------------- | ---------------------------- | ------- |
| `serviceAccount.create`      | Create service account       | `true`  |
| `serviceAccount.automount`   | Automount SA token           | `true`  |
| `serviceAccount.annotations` | SA annotations               | `{}`    |
| `serviceAccount.name`        | SA name (generated if empty) | `""`    |

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
| `ingress.annotations` | Ingress annotations         | `{}`    |
| `ingress.hosts`       | Ingress hosts configuration | See values.yaml |
| `ingress.tls`         | Ingress TLS configuration   | `[]`            |

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
| `resources.limits.memory`   | Memory limit   | `512Mi` |
| `resources.requests.cpu`    | CPU request    | `100m`  |
| `resources.requests.memory` | Memory request | `128Mi` |

## Health Checks

| Parameter                            | Description   | Default |
| ------------------------------------ | ------------- | ------- |
| `livenessProbe.initialDelaySeconds`  | Initial delay | `30`    |
| `livenessProbe.periodSeconds`        | Check period  | `30`    |
| `readinessProbe.initialDelaySeconds` | Initial delay | `10`    |
| `readinessProbe.periodSeconds`       | Check period  | `10`    |

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

| Parameter                          | Description                         | Default    |
| ---------------------------------- | ----------------------------------- | ---------- |
| `metrics.enabled`                  | Enable application metrics          | `true`     |
| `metrics.serviceMonitor.enabled`   | Create a Prometheus ServiceMonitor  | `false`    |
| `metrics.serviceMonitor.interval`  | Scraping interval                   | `30s`      |
| `metrics.serviceMonitor.path`      | Metrics path                        | `/metrics` |
| `metrics.serviceMonitor.additionalLabels` | Additional labels for ServiceMonitor | `{}`       |

## Network Policy

| Parameter                                  | Description                               | Default |
| ------------------------------------------ | ----------------------------------------- | ------- |
| `networkPolicy.enabled`                    | Enable NetworkPolicy                      | `false` |
| `networkPolicy.ingress.podSelector`        | Pod selector for ingress rules            | `{}`    |
| `networkPolicy.ingress.namespaceSelector`  | Namespace selector for ingress rules      | `{}`    |
| `networkPolicy.ingress.additionalRules`    | Additional ingress rules                  | `[]`    |
| `networkPolicy.egress.additionalRules`     | Additional egress rules                   | `[]`    |

## Application Configuration

| Parameter                    | Description                                | Default       |
| ---------------------------- | ------------------------------------------ | ------------- |
| `config.create`              | Create ConfigMap for app configuration     | `true`        |
| `config.logLevel`            | Application log level (debug/info/warn/error) | `info`        |
| `config.sessionTimeout`      | Session timeout in milliseconds            | `604800000`   |
| `config.wsPingInterval`      | WebSocket ping interval in milliseconds    | `30000`       |
| `config.cacheTtl`            | Cache TTL for dashboard data in seconds    | `30`          |
| `config.additionalConfig`    | Additional configuration key-value pairs   | `{}`          |

## Encryption Configuration

| Parameter                    | Description                                | Default |
| ---------------------------- | ------------------------------------------ | ------- |
| `encryption.gyreKey`         | Key for encrypting cluster kubeconfigs     | `""`    |
| `encryption.authKey`         | Key for encrypting OAuth client secrets    | `""`    |
| `encryption.existingSecret`  | Existing secret with encryption keys       | `""`    |

## Upgrade Procedure

To upgrade Gyre:

```bash
# Update Helm repository
helm repo update

# Upgrade release
helm upgrade gyre gyre/gyre 
  --namespace flux-system
```

### Upgrade with Backup

```bash
# 1. Backup database
POD=$(kubectl get pod -n flux-system -l app.kubernetes.io/name=gyre -o jsonpath='{.items[0].metadata.name}')
kubectl cp flux-system/$POD:/data/gyre.db ./gyre-backup-$(date +%Y%m%d).db

# 2. Perform upgrade
helm upgrade gyre gyre/gyre --namespace flux-system

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

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup-file>"
  exit 1
fi

# Scale down
kubectl scale deployment gyre -n $NAMESPACE --replicas=0
kubectl wait --for=delete pod -l app.kubernetes.io/name=gyre -n $NAMESPACE --timeout=60s

# Scale up
kubectl scale deployment gyre -n $NAMESPACE --replicas=1
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=gyre -n $NAMESPACE --timeout=120s

POD=$(kubectl get pod -n $NAMESPACE -l app.kubernetes.io/name=gyre -o jsonpath='{.items[0].metadata.name}')

# Restore database
kubectl cp $BACKUP_FILE $NAMESPACE/$POD:/data/gyre.db

echo "Database restored from: $BACKUP_FILE"
```
