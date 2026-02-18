# Gyre Helm Chart

Modern WebUI for FluxCD with real-time monitoring, RBAC, and comprehensive resource management.

[![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](Chart.yaml)
[![Type](https://img.shields.io/badge/type-application-informational.svg)](Chart.yaml)
[![AppVersion](https://img.shields.io/badge/app%20version-0.1.0-informational.svg)](Chart.yaml)

## Documentation

Comprehensive documentation for the Helm chart, including configuration options, installation, and upgrades, has been migrated to the official documentation site:

**[📚 Helm Chart Documentation](https://entropy0120.github.io/gyre/installation/helm-reference)**

## Quick Start

```bash
# Add the Gyre Helm repository
helm repo add gyre https://entropy0120.github.io/gyre
helm repo update

# Install Gyre
helm install gyre gyre/gyre \
  --namespace flux-system \
  --create-namespace
```

For more detailed configuration, please refer to the **[Helm Chart Reference](https://entropy0120.github.io/gyre/installation/helm-reference)**.

## Support

- **Issues**: https://github.com/EnTRoPY0120/gyre/issues
- **Repository**: https://github.com/EnTRoPY0120/gyre
- **Discussions**: https://github.com/EnTRoPY0120/gyre/discussions

## License

MIT License - See [LICENSE](../../LICENSE) file for details.
