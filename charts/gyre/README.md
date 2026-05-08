# Gyre Helm Chart

Modern WebUI for FluxCD with real-time monitoring, RBAC, and comprehensive resource management.

[![Type](https://img.shields.io/badge/type-application-informational.svg)](Chart.yaml)
[![GitHub release](https://img.shields.io/github/v/release/entropy0120/gyre?label=version&style=flat)](https://github.com/entropy0120/gyre/releases/latest)

## Documentation

Comprehensive documentation for the Helm chart, including configuration options, installation, and upgrades, has been migrated to the official documentation site:

**[📚 Helm Chart Documentation](https://entropy0120.github.io/gyre/installation/helm-reference)**

## Quick Start

```bash
kubectl create namespace flux-system --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic gyre-encryption -n flux-system \
  --from-literal=GYRE_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=AUTH_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --from-literal=BACKUP_ENCRYPTION_KEY="$(openssl rand -hex 32)" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl create secret generic gyre-metrics -n flux-system \
  --from-literal=GYRE_METRICS_TOKEN="$(openssl rand -hex 32)" \
  --dry-run=client -o yaml | kubectl apply -f -

# Install Gyre
helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
  --namespace flux-system \
  --create-namespace \
  --set encryption.existingSecret=gyre-encryption \
  --set metrics.existingSecret=gyre-metrics
```

For more detailed configuration, please refer to the **[Helm Chart Reference](https://entropy0120.github.io/gyre/installation/helm-reference)**.

## Support

- **Issues**: https://github.com/EnTRoPY0120/gyre/issues
- **Repository**: https://github.com/EnTRoPY0120/gyre
- **Discussions**: https://github.com/EnTRoPY0120/gyre/discussions

## License

MIT License - See [LICENSE](../../LICENSE) file for details.
