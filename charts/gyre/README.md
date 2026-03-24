# Gyre Helm Chart

Modern WebUI for FluxCD with real-time monitoring, RBAC, and comprehensive resource management.

[![Type](https://img.shields.io/badge/type-application-informational.svg)](Chart.yaml)
[![GitHub release](https://img.shields.io/github/v/release/entropy0120/gyre?label=version&style=flat)](https://github.com/entropy0120/gyre/releases/latest)

## Documentation

Comprehensive documentation for the Helm chart, including configuration options, installation, and upgrades, has been migrated to the official documentation site:

**[📚 Helm Chart Documentation](https://entropy0120.github.io/gyre/installation/helm-reference)**

## Quick Start

```bash
# Install Gyre
helm install gyre oci://ghcr.io/entropy0120/charts/gyre \
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
