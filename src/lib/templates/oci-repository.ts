import type { ResourceTemplate } from './types.js';

export const OCI_REPOSITORY_TEMPLATE: ResourceTemplate = {
	id: 'oci-repository-base',
	name: 'OCI Repository',
	description: 'Sources from an OCI registry',
	kind: 'OCIRepository',
	group: 'source.toolkit.fluxcd.io',
	version: 'v1',
	category: 'sources',
	plural: 'ocirepositories',
	yaml: `apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  url: oci://ghcr.io/org/manifests
  ref:
    tag: v1.0.0`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'source',
			title: 'OCI Configuration',
			description: 'OCI registry and artifact settings',
			defaultExpanded: true
		},
		{
			id: 'auth',
			title: 'Authentication',
			description: 'Registry credentials',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'advanced',
			title: 'Advanced Options',
			description: 'Additional configuration options',
			collapsible: true,
			defaultExpanded: false
		}
	],
	fields: [
		// Basic Information
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			section: 'basic',
			placeholder: 'my-oci-repo',
			description: 'Unique name for this OCIRepository resource',
			validation: {
				pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
				message:
					'Name must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)'
			}
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			section: 'basic',
			default: 'flux-system',
			description: 'Namespace where the resource will be created',
			validation: {
				pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
				message:
					'Namespace must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)'
			}
		},

		// OCI Configuration
		{
			name: 'url',
			label: 'Repository URL',
			path: 'spec.url',
			type: 'string',
			required: true,
			section: 'source',
			placeholder: 'oci://ghcr.io/org/manifests',
			description: 'OCI repository URL (must start with oci://)',
			validation: {
				pattern: '^oci://',
				message: 'OCI repository URL must start with oci://'
			}
		},
		{
			name: 'provider',
			label: 'OCI Provider',
			path: 'spec.provider',
			type: 'select',
			section: 'source',
			default: 'generic',
			options: [
				{ label: 'Generic', value: 'generic' },
				{ label: 'AWS', value: 'aws' },
				{ label: 'Azure', value: 'azure' },
				{ label: 'GCP', value: 'gcp' }
			],
			description: 'Cloud provider for OCI registry authentication'
		},
		{
			name: 'refType',
			label: 'Reference Type',
			path: 'spec.ref.type',
			type: 'select',
			section: 'source',
			default: 'tag',
			virtual: true,
			options: [
				{ label: 'Tag', value: 'tag' },
				{ label: 'Semver', value: 'semver' },
				{ label: 'Digest', value: 'digest' }
			],
			description: 'Type of reference to track'
		},
		{
			name: 'tag',
			label: 'Tag',
			path: 'spec.ref.tag',
			type: 'string',
			section: 'source',
			placeholder: 'v1.0.0',
			description:
				"Tag to track. Avoid 'latest' — pin to an explicit version for reproducible deployments.",
			showIf: {
				field: 'refType',
				value: 'tag'
			}
		},
		{
			name: 'semver',
			label: 'Semver Range',
			path: 'spec.ref.semver',
			type: 'string',
			section: 'source',
			placeholder: '>=1.0.0',
			description: 'Semver range to track',
			showIf: {
				field: 'refType',
				value: 'semver'
			},
			validation: {
				pattern:
					'^(?:[<>]=?|=|~|\\^|\\*)?\\s*[0-9]+\\.[0-9]+(?:\\.[0-9]+)?(?:[-+][0-9A-Za-z.-]+)?$',
				message: 'Must be a valid semver constraint (e.g., >=1.0.0, ~1.2.0, ^2.0.0)'
			}
		},
		{
			name: 'digest',
			label: 'Digest',
			path: 'spec.ref.digest',
			type: 'string',
			section: 'source',
			placeholder: 'sha256:abc123...',
			description: 'Digest to track',
			showIf: {
				field: 'refType',
				value: 'digest'
			}
		},
		{
			name: 'layerSelector',
			label: 'Layer Selector',
			path: 'spec.layerSelector',
			type: 'object',
			section: 'source',
			objectFields: [
				{ name: 'mediaType', label: 'Media Type', path: 'mediaType', type: 'string' },
				{
					name: 'operation',
					label: 'Operation',
					path: 'operation',
					type: 'select',
					options: [
						{ label: 'Extract', value: 'extract' },
						{ label: 'Copy', value: 'copy' }
					]
				}
			],
			description: 'Select specific OCI layer to extract or copy'
		},
		{
			name: 'interval',
			label: 'Sync Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'source',
			default: '5m',
			placeholder: '5m',
			description: 'How often to check for changes',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message:
					'Duration must use time units like: 1m (minutes), 30s (seconds), 1h (hours), or combined like 1h30m'
			}
		},

		// Authentication
		{
			name: 'secretRefName',
			label: 'Secret Name',
			path: 'spec.secretRef.name',
			type: 'string',
			section: 'auth',
			placeholder: 'oci-credentials',
			description: 'Secret containing registry credentials'
		},
		{
			name: 'serviceAccountName',
			label: 'Service Account',
			path: 'spec.serviceAccountName',
			type: 'string',
			section: 'auth',
			placeholder: 'oci-puller',
			description: 'ServiceAccount for registry authentication'
		},
		{
			name: 'proxySecretRef',
			label: 'Proxy Secret',
			path: 'spec.proxySecretRef.name',
			type: 'string',
			section: 'auth',
			placeholder: 'proxy-credentials',
			description: 'Secret containing proxy credentials'
		},

		// Advanced Options
		{
			name: 'suspend',
			label: 'Suspend',
			path: 'spec.suspend',
			type: 'boolean',
			section: 'advanced',
			default: false,
			description: 'Suspend reconciliation'
		},
		{
			name: 'timeout',
			label: 'Timeout',
			path: 'spec.timeout',
			type: 'duration',
			section: 'advanced',
			default: '10m',
			placeholder: '60s',
			description: 'Timeout for OCI operations',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		},
		{
			name: 'ignore',
			label: 'Ignore Paths',
			path: 'spec.ignore',
			type: 'textarea',
			section: 'advanced',
			placeholder: '# .gitignore format\n*.md',
			description: 'Paths to ignore when calculating artifact checksum'
		},
		{
			name: 'certSecretRef',
			label: 'TLS Secret',
			path: 'spec.certSecretRef.name',
			type: 'string',
			section: 'advanced',
			placeholder: 'oci-tls-certs',
			description: 'Secret containing CA/cert/key for TLS authentication'
		},
		{
			name: 'insecure',
			label: 'Insecure',
			path: 'spec.insecure',
			type: 'boolean',
			section: 'advanced',
			default: false,
			description: 'Allow insecure connections (skip TLS verification)'
		},
		{
			name: 'verify',
			label: 'Verify',
			path: 'spec.verify',
			type: 'object',
			section: 'advanced',
			objectFields: [
				{
					name: 'provider',
					label: 'Provider',
					path: 'provider',
					type: 'select',
					options: [
						{ label: 'Cosign', value: 'cosign' },
						{ label: 'Notation', value: 'notation' }
					]
				},
				{
					name: 'secretRef',
					label: 'Secret',
					path: 'secretRef',
					type: 'object',
					objectFields: [
						{
							name: 'name',
							label: 'Secret Name',
							path: 'name',
							type: 'string'
						}
					]
				}
			],
			description: 'Signature verification configuration'
		}
	]
};
