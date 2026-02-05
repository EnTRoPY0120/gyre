---
sidebar_position: 3
---

# Installation

Gyre can be installed in several ways depending on your environment and requirements.

## Helm Installation (Recommended)

Helm is the recommended way to install Gyre as it provides easy configuration and upgrades.

### Basic Installation

```bash
# Add the Gyre Helm repository
helm repo add gyre https://entropy0120.github.io/gyre
helm repo update

# Install with default values
helm install gyre gyre/gyre \
  --namespace flux-system \
  --create-namespace
```

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
helm install gyre gyre/gyre \
  --namespace flux-system \
  --create-namespace \
  -f values.yaml
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
  enabled: true
  providers:
    - name: github
      type: github
      clientId: 'your-client-id'
      clientSecret: 'your-client-secret'
```

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
# Update Helm repository
helm repo update

# Upgrade release
helm upgrade gyre gyre/gyre \
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
