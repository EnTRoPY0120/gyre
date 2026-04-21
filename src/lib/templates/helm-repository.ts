import type { ResourceTemplate } from './types.js';

export const HELM_REPOSITORY_TEMPLATE: ResourceTemplate = {
	id: 'helm-repository-base',
	name: 'Helm Repository',
	description: 'Sources from a Helm chart repository',
	kind: 'HelmRepository',
	group: 'source.toolkit.fluxcd.io',
	version: 'v1',
	category: 'sources',
	plural: 'helmrepositories',
	yaml: `apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  url: https://charts.bitnami.com/bitnami`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'source',
			title: 'Repository Configuration',
			description: 'Helm repository settings',
			defaultExpanded: true
		},
		{
			id: 'auth',
			title: 'Authentication',
			description: 'Credentials and TLS configuration',
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
			placeholder: 'my-helm-repo',
			description: 'Unique name for this HelmRepository resource',
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

		// Repository Configuration
		{
			name: 'type',
			label: 'Repository Type',
			path: 'spec.type',
			type: 'select',
			section: 'source',
			default: 'default',
			options: [
				{ label: 'Default (HTTP/S)', value: 'default' },
				{ label: 'OCI', value: 'oci' }
			],
			description: 'Type of Helm repository'
		},
		{
			name: 'provider',
			label: 'Provider',
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
			description: 'Cloud provider for OCI repository',
			showIf: {
				field: 'type',
				value: 'oci'
			}
		},
		{
			name: 'url',
			label: 'Repository URL',
			path: 'spec.url',
			type: 'string',
			required: true,
			section: 'source',
			placeholder: 'https://charts.bitnami.com/bitnami',
			description: 'HTTP/S Helm repository URL',
			validation: {
				pattern: '^https?://',
				message: 'URL must start with https:// or http://'
			},
			showIf: {
				field: 'type',
				value: 'default'
			}
		},
		{
			name: 'url_oci',
			label: 'Repository URL',
			path: 'spec.url',
			type: 'string',
			required: true,
			section: 'source',
			placeholder: 'oci://ghcr.io/org/charts',
			description: 'OCI registry URL (must start with oci://)',
			validation: {
				pattern: '^oci://',
				message: 'OCI repository URL must start with oci://'
			},
			showIf: {
				field: 'type',
				value: 'oci'
			}
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
			description: 'How often to check for new chart versions',
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
			placeholder: 'helm-repo-credentials',
			description:
				'Secret containing authentication credentials (username/password or certFile/keyFile)'
		},
		{
			name: 'passCredentials',
			label: 'Pass Credentials',
			path: 'spec.passCredentials',
			type: 'boolean',
			section: 'auth',
			default: false,
			description: 'Pass credentials to all domains'
		},
		{
			name: 'insecure',
			label: 'Insecure',
			path: 'spec.insecure',
			type: 'boolean',
			section: 'auth',
			default: false,
			description: 'Allow insecure connections (skip TLS verification)'
		},
		{
			name: 'certSecretRef',
			label: 'TLS Secret',
			path: 'spec.certSecretRef.name',
			type: 'string',
			section: 'auth',
			placeholder: 'helm-tls-certs',
			description: 'Secret containing CA/cert/key for TLS authentication'
		},

		// Advanced Options
		{
			name: 'suspend',
			label: 'Suspend',
			path: 'spec.suspend',
			type: 'boolean',
			section: 'advanced',
			default: false,
			description: 'Suspend reconciliation of this repository'
		},
		{
			name: 'accessFrom',
			label: 'Access From',
			path: 'spec.accessFrom.namespaceSelectors',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'matchLabels',
					label: 'Match Labels',
					path: 'matchLabels',
					type: 'textarea',
					placeholder: 'role: frontend'
				}
			],
			description: 'Cross-namespace access control'
		},
		{
			name: 'timeout',
			label: 'Timeout',
			path: 'spec.timeout',
			type: 'duration',
			section: 'advanced',
			default: '10m',
			placeholder: '60s',
			description: 'Timeout for index download operations',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		}
	]
};
