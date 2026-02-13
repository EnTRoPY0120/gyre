# Gyre Helm Chart

Modern WebUI for FluxCD with real-time monitoring, RBAC, and comprehensive resource management.

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](Chart.yaml)
[![Type](https://img.shields.io/badge/type-application-informational.svg)](Chart.yaml)
[![AppVersion](https://img.shields.io/badge/app%20version-0.1.0-informational.svg)](Chart.yaml)

## TL;DR

```bash
helm install gyre oci://ghcr.io/entropy0120/gyre-chart \
  --namespace flux-system \
  --create-namespace
```

## Introduction

This chart bootstraps a Gyre deployment on a Kubernetes cluster using the Helm package manager. Gyre provides a modern web interface for managing FluxCD resources with features including:

- 🎯 Real-time monitoring of all FluxCD resources
- 🔐 Built-in authentication and RBAC
- 📊 Live status updates via WebSockets
- 🌐 Multi-cluster support (future)
- 📝 Comprehensive audit logging

## Prerequisites

- Kubernetes 1.20+
- Helm 3.8+
- FluxCD v2.0+ installed in the cluster
- PersistentVolume provisioner support in the underlying infrastructure

## Installing the Chart

### From OCI Registry (Recommended)

```bash
helm install gyre oci://ghcr.io/entropy0120/gyre-chart \
  --version 0.1.0 \
  --namespace flux-system \
  --create-namespace
```

### From Local Chart

```bash
helm install gyre ./charts/gyre \
  --namespace flux-system \
  --create-namespace
```

### With Custom Values

```bash
helm install gyre ./charts/gyre \
  --namespace flux-system \
  --create-namespace \
  --values custom-values.yaml
```

The command deploys Gyre on the Kubernetes cluster with default configuration. See [Configuration](#configuration) section for customizable parameters.

## Accessing Gyre

### 1. Retrieve Admin Credentials

After installation, get the auto-generated admin password:

```bash
kubectl get secret gyre-initial-admin-secret \
  -n flux-system \
  -o jsonpath='{.data.password}' | base64 -d && echo
```

**Default credentials:**

- Username: `admin`
- Password: (from command above)

⚠️ **Important**: Change this password immediately after first login!

### 2. Access Methods

#### Port Forward (Development/Quick Access)

```bash
kubectl port-forward -n flux-system svc/gyre 3000:80
```

Then visit: http://localhost:3000

#### Ingress (Production)

Configure ingress in `values.yaml` or via CLI:

```bash
helm upgrade gyre ./charts/gyre \
  --namespace flux-system \
  --set ingress.enabled=true \
  --set ingress.className=nginx \
  --set ingress.hosts[0].host=gyre.example.com \
  --set ingress.hosts[0].paths[0].path=/ \
  --set ingress.hosts[0].paths[0].pathType=Prefix
```

## Uninstalling the Chart

```bash
helm uninstall gyre --namespace flux-system
```

This removes all Kubernetes resources associated with the chart and deletes the Helm release.

⚠️ **Data Persistence**: By default, the PersistentVolumeClaim is retained. To delete it:

```bash
kubectl delete pvc gyre-data -n flux-system
```

## Configuration

### Global Parameters

| Parameter          | Description                            | Default |
| ------------------ | -------------------------------------- | ------- |
| `nameOverride`     | Override chart name                    | `""`    |
| `fullnameOverride` | Override fully qualified app name      | `""`    |
| `replicaCount`     | Number of replicas (SQLite requires 1) | `1`     |

### Image Configuration

| Parameter          | Description                                | Default                    |
| ------------------ | ------------------------------------------ | -------------------------- |
| `image.repository` | Container image repository                 | `ghcr.io/entropy0120/gyre` |
| `image.tag`        | Container image tag (overrides appVersion) | `""`                       |
| `image.pullPolicy` | Image pull policy                          | `IfNotPresent`             |
| `imagePullSecrets` | Image pull secrets                         | `[]`                       |

### Service Account

| Parameter                    | Description                  | Default |
| ---------------------------- | ---------------------------- | ------- |
| `serviceAccount.create`      | Create service account       | `true`  |
| `serviceAccount.automount`   | Automount SA token           | `true`  |
| `serviceAccount.annotations` | SA annotations               | `{}`    |
| `serviceAccount.name`        | SA name (generated if empty) | `""`    |

### Service Configuration

| Parameter            | Description             | Default     |
| -------------------- | ----------------------- | ----------- |
| `service.type`       | Kubernetes service type | `ClusterIP` |
| `service.port`       | Service port            | `80`        |
| `service.targetPort` | Container target port   | `3000`      |

### Ingress Configuration

| Parameter             | Description                 | Default         |
| --------------------- | --------------------------- | --------------- |
| `ingress.enabled`     | Enable ingress              | `false`         |
| `ingress.className`   | Ingress class name          | `""`            |
| `ingress.annotations` | Ingress annotations         | `{}`            |
| `ingress.hosts`       | Ingress hosts configuration | See values.yaml |
| `ingress.tls`         | Ingress TLS configuration   | `[]`            |

### Persistence

| Parameter                   | Description                          | Default         |
| --------------------------- | ------------------------------------ | --------------- |
| `persistence.enabled`       | Enable persistent storage            | `true`          |
| `persistence.accessMode`    | PVC access mode                      | `ReadWriteOnce` |
| `persistence.size`          | PVC size                             | `1Gi`           |
| `persistence.storageClass`  | Storage class name (blank = default) | `""`            |
| `persistence.annotations`   | PVC annotations                      | `{}`            |
| `persistence.existingClaim` | Use existing PVC                     | `""`            |

### Security Context

| Parameter                                  | Description                | Default   |
| ------------------------------------------ | -------------------------- | --------- |
| `podSecurityContext.runAsNonRoot`          | Run as non-root            | `true`    |
| `podSecurityContext.runAsUser`             | User ID                    | `1001`    |
| `podSecurityContext.fsGroup`               | Filesystem group           | `1001`    |
| `securityContext.allowPrivilegeEscalation` | Allow privilege escalation | `false`   |
| `securityContext.capabilities.drop`        | Drop capabilities          | `["ALL"]` |
| `securityContext.readOnlyRootFilesystem`   | Read-only root FS          | `true`    |

### Resource Limits

| Parameter                   | Description    | Default |
| --------------------------- | -------------- | ------- |
| `resources.limits.cpu`      | CPU limit      | `500m`  |
| `resources.limits.memory`   | Memory limit   | `512Mi` |
| `resources.requests.cpu`    | CPU request    | `100m`  |
| `resources.requests.memory` | Memory request | `128Mi` |

### Health Checks

| Parameter                            | Description   | Default |
| ------------------------------------ | ------------- | ------- |
| `livenessProbe.initialDelaySeconds`  | Initial delay | `30`    |
| `livenessProbe.periodSeconds`        | Check period  | `30`    |
| `readinessProbe.initialDelaySeconds` | Initial delay | `10`    |
| `readinessProbe.periodSeconds`       | Check period  | `10`    |

### RBAC

| Parameter                 | Description           | Default |
| ------------------------- | --------------------- | ------- |
| `rbac.create`             | Create RBAC resources | `true`  |
| `rbac.clusterRole.create` | Create ClusterRole    | `true`  |
| `rbac.clusterRole.rules`  | Additional RBAC rules | `[]`    |

### Admin Configuration

| Parameter            | Description                  | Default                     |
| -------------------- | ---------------------------- | --------------------------- |
| `admin.autoGenerate` | Auto-generate admin password | `true`                      |
| `admin.secretName`   | Admin password secret name   | `gyre-initial-admin-secret` |

### Metrics & Monitoring

| Parameter                          | Description                         | Default    |
| ---------------------------------- | ----------------------------------- | ---------- |
| `metrics.enabled`                  | Enable application metrics          | `true`     |
| `metrics.serviceMonitor.enabled`   | Create a Prometheus ServiceMonitor  | `false`    |
| `metrics.serviceMonitor.interval`  | Scraping interval                   | `30s`      |
| `metrics.serviceMonitor.path`      | Metrics path                        | `/metrics` |
| `metrics.serviceMonitor.additionalLabels` | Additional labels for ServiceMonitor | `{}`       |

### Network Policy

| Parameter                                  | Description                               | Default |
| ------------------------------------------ | ----------------------------------------- | ------- |
| `networkPolicy.enabled`                    | Enable NetworkPolicy                      | `false` |
| `networkPolicy.ingress.podSelector`        | Pod selector for ingress rules            | `{}`    |
| `networkPolicy.ingress.namespaceSelector`  | Namespace selector for ingress rules      | `{}`    |
| `networkPolicy.ingress.additionalRules`    | Additional ingress rules                  | `[]`    |
| `networkPolicy.egress.additionalRules`     | Additional egress rules                   | `[]`    |

### Application Configuration

| Parameter                    | Description                                | Default       |
| ---------------------------- | ------------------------------------------ | ------------- |
| `config.create`              | Create ConfigMap for app configuration     | `true`        |
| `config.logLevel`            | Application log level (debug/info/warn/error) | `info`        |
| `config.sessionTimeout`      | Session timeout in milliseconds            | `604800000`   |
| `config.wsPingInterval`      | WebSocket ping interval in milliseconds    | `30000`       |
| `config.cacheTtl`            | Cache TTL for dashboard data in seconds    | `30`          |
| `config.additionalConfig`    | Additional configuration key-value pairs   | `{}`          |

### Encryption Configuration

| Parameter                    | Description                                | Default |
| ---------------------------- | ------------------------------------------ | ------- |
| `encryption.gyreKey`         | Key for encrypting cluster kubeconfigs     | `""`    |
| `encryption.authKey`         | Key for encrypting OAuth client secrets    | `""`    |
| `encryption.existingSecret`  | Existing secret with encryption keys       | `""`    |

## Examples

### Production Deployment with Ingress and TLS

```yaml
# production-values.yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: 'true'
  hosts:
    - host: gyre.company.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: gyre-tls
      hosts:
        - gyre.company.com

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 250m
    memory: 256Mi

persistence:
  size: 5Gi
  storageClass: fast-ssd
```

```bash
helm install gyre ./charts/gyre \
  --namespace flux-system \
  --create-namespace \
  --values production-values.yaml
```

### High Resource Environment

```bash
helm install gyre ./charts/gyre \
  --namespace flux-system \
  --set resources.limits.cpu=2000m \
  --set resources.limits.memory=2Gi \
  --set persistence.size=10Gi
```

### Custom Storage Class

```bash
helm install gyre ./charts/gyre \
  --namespace flux-system \
  --set persistence.storageClass=local-path
```

### Using Existing PVC

```bash
helm install gyre ./charts/gyre \
  --namespace flux-system \
  --set persistence.existingClaim=my-existing-pvc
```

## Upgrading

### Standard Upgrade

```bash
helm upgrade gyre ./charts/gyre \
  --namespace flux-system \
  --values custom-values.yaml
```

### Upgrade with Backup

```bash
# 1. Backup database
POD=$(kubectl get pod -n flux-system -l app.kubernetes.io/name=gyre -o jsonpath='{.items[0].metadata.name}')
kubectl cp flux-system/$POD:/data/gyre.db ./gyre-backup-$(date +%Y%m%d).db

# 2. Perform upgrade
helm upgrade gyre ./charts/gyre --namespace flux-system

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

- PVC not bound: Check StorageClass and PV availability
- Image pull errors: Verify `image.repository` and `imagePullSecrets`
- Insufficient resources: Check node capacity

### Database Issues

**Check PVC status**:

```bash
kubectl get pvc -n flux-system
kubectl describe pvc gyre-data -n flux-system
```

**Verify database file**:

```bash
POD=$(kubectl get pod -n flux-system -l app.kubernetes.io/name=gyre -o jsonpath='{.items[0].metadata.name}')
kubectl exec -n flux-system $POD -- ls -lah /data
```

**Database corruption**:

```bash
# Stop pod
kubectl scale deployment gyre -n flux-system --replicas=0

# Restore from backup (if available)
kubectl cp ./gyre-backup.db flux-system/$POD:/data/gyre.db

# Restart
kubectl scale deployment gyre -n flux-system --replicas=1
```

### RBAC Permission Errors

**Test ServiceAccount permissions**:

```bash
# Check if SA can list FluxCD resources
kubectl auth can-i get gitrepositories.source.toolkit.fluxcd.io \
  --as=system:serviceaccount:flux-system:gyre \
  --all-namespaces

# Check ClusterRole binding
kubectl get clusterrolebinding -l app.kubernetes.io/instance=gyre
```

**View denied operations in logs**:

```bash
kubectl logs -n flux-system -l app.kubernetes.io/name=gyre | grep "forbidden"
```

### Connection Issues

**Health check failing**:

```bash
# Port-forward and test health endpoint
kubectl port-forward -n flux-system svc/gyre 3000:80 &
curl http://localhost:3000/api/flux/health
```

**Check Kubernetes connectivity**:

```bash
# Exec into pod
kubectl exec -it -n flux-system deployment/gyre -- sh

# Test K8s API from inside pod
wget -O- --header="Authorization: Bearer $(cat /var/run/secrets/kubernetes.io/serviceaccount/token)" \
  --no-check-certificate \
  https://kubernetes.default.svc/api/v1/namespaces
```

### Ingress Not Working

**Check Ingress status**:

```bash
kubectl get ingress -n flux-system
kubectl describe ingress gyre -n flux-system
```

**Common issues**:

- IngressClass not found: Verify `ingress.className` matches available class
- TLS certificate issues: Check cert-manager logs if using
- Path routing issues: Ensure `pathType: Prefix` for SPA

### High Memory Usage

**Check resource usage**:

```bash
kubectl top pod -n flux-system -l app.kubernetes.io/name=gyre
```

**Increase limits if needed**:

```bash
helm upgrade gyre ./charts/gyre \
  --namespace flux-system \
  --set resources.limits.memory=1Gi
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

## Security Considerations

### Best Practices

1. **Change Default Password**: Immediately change admin password after installation
2. **Enable HTTPS**: Always use TLS/HTTPS in production via Ingress
3. **Network Policies**: Implement NetworkPolicies to restrict traffic
4. **RBAC**: Review and customize ClusterRole permissions as needed
5. **Secrets Management**: Consider using External Secrets Operator
6. **Regular Backups**: Automate database backups
7. **Update Regularly**: Keep chart and image versions up to date

### Pod Security Standards

Gyre pod meets **Restricted** Pod Security Standard:

- ✅ Runs as non-root user (UID 1001)
- ✅ Drops all capabilities
- ✅ No privilege escalation
- ✅ Seccomp profile configured
- ❌ Read-only root filesystem (disabled for SQLite)

### Network Policies

Example NetworkPolicy to restrict traffic:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: gyre
  namespace: flux-system
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: gyre
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - namespaceSelector: {}
      ports:
        - protocol: TCP
          port: 443 # Kubernetes API
```

## Monitoring

### Prometheus Integration

Gyre exposes Prometheus metrics at `/metrics`:

```yaml
# ServiceMonitor example (if using Prometheus Operator)
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: gyre
  namespace: flux-system
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: gyre
  endpoints:
    - port: http
      path: /metrics
      interval: 30s
```

## Limitations

- **Single Replica Only**: SQLite requires single replica (no HA)
- **ReadWriteOnce PVC**: Cannot share storage across multiple replicas
- **No Built-in Backup**: Manual backup required
- **In-Cluster Only**: Must run inside Kubernetes cluster

## Future Enhancements

- PostgreSQL support for multi-replica HA
- Built-in backup automation
- Prometheus metrics endpoint
- Grafana dashboard
- Multi-cluster federation

## Support

- **Issues**: https://github.com/EnTRoPY0120/gyre/issues
- **Documentation**: https://github.com/EnTRoPY0120/gyre
- **Discussions**: https://github.com/EnTRoPY0120/gyre/discussions

## License

MIT License - See LICENSE file for details

## Maintainers

- [@EnTRoPY0120](https://github.com/EnTRoPY0120)

---

**Chart Version**: 0.1.0
**App Version**: 0.1.0
**Updated**: 2026-02-04
