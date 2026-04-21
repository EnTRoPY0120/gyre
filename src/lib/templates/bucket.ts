import type { ResourceTemplate } from './types.js';

export const BUCKET_TEMPLATE: ResourceTemplate = {
	id: 'bucket-base',
	name: 'Bucket',
	description: 'Sources from an S3-compatible bucket',
	kind: 'Bucket',
	group: 'source.toolkit.fluxcd.io',
	version: 'v1',
	category: 'sources',
	plural: 'buckets',
	yaml: `apiVersion: source.toolkit.fluxcd.io/v1
kind: Bucket
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  provider: generic
  bucketName: my-bucket
  endpoint: s3.amazonaws.com`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'bucket',
			title: 'Bucket Configuration',
			description: 'S3-compatible bucket settings',
			defaultExpanded: true
		},
		{
			id: 'auth',
			title: 'Authentication',
			description: 'Credentials and access configuration',
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
			placeholder: 'my-bucket',
			description: 'Unique name for this Bucket resource',
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

		// Bucket Configuration
		{
			name: 'provider',
			label: 'Provider',
			path: 'spec.provider',
			type: 'select',
			required: true,
			section: 'bucket',
			default: 'generic',
			options: [
				{ label: 'Generic S3', value: 'generic' },
				{ label: 'AWS S3', value: 'aws' },
				{ label: 'Google Cloud Storage', value: 'gcp' },
				{ label: 'Azure Blob Storage', value: 'azure' }
			],
			description: 'Cloud provider type'
		},
		{
			name: 'bucketName',
			label: 'Bucket Name',
			path: 'spec.bucketName',
			type: 'string',
			required: true,
			section: 'bucket',
			placeholder: 'my-artifacts',
			description: 'Name of the S3 bucket'
		},
		{
			name: 'prefix',
			label: 'Prefix',
			path: 'spec.prefix',
			type: 'string',
			section: 'bucket',
			placeholder: 'path/to/artifacts/',
			description: 'Object prefix to filter objects in the bucket'
		},
		{
			name: 'endpoint',
			label: 'Endpoint',
			path: 'spec.endpoint',
			type: 'string',
			required: true,
			section: 'bucket',
			placeholder: 's3.amazonaws.com',
			description: 'S3-compatible endpoint URL'
		},
		{
			name: 'region',
			label: 'Region',
			path: 'spec.region',
			type: 'string',
			section: 'bucket',
			placeholder: 'us-east-1',
			description: 'Bucket region'
		},
		{
			name: 'sts',
			label: 'STS Configuration',
			path: 'spec.sts',
			type: 'object',
			section: 'bucket',
			objectFields: [
				{
					name: 'provider',
					label: 'Provider',
					path: 'provider',
					type: 'string',
					required: true
				},
				{
					name: 'endpoint',
					label: 'Endpoint',
					path: 'endpoint',
					type: 'string',
					required: true
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
				},
				{
					name: 'certSecretRef',
					label: 'TLS Secret',
					path: 'certSecretRef',
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
			description: 'Security Token Service configuration'
		},
		{
			name: 'interval',
			label: 'Sync Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'bucket',
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
			placeholder: 's3-credentials',
			description: 'Secret containing access key and secret key'
		},
		{
			name: 'serviceAccountName',
			label: 'Service Account',
			path: 'spec.serviceAccountName',
			type: 'string',
			section: 'auth',
			placeholder: 'bucket-puller',
			description: 'ServiceAccount for cloud provider authentication'
		},
		{
			name: 'certSecretRef',
			label: 'TLS Secret',
			path: 'spec.certSecretRef.name',
			type: 'string',
			section: 'auth',
			placeholder: 'bucket-tls-certs',
			description: 'Secret containing CA/cert/key for TLS authentication (Generic provider only)'
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
		{
			name: 'insecure',
			label: 'Insecure',
			path: 'spec.insecure',
			type: 'boolean',
			section: 'auth',
			default: false,
			description: 'Allow insecure connections (skip TLS verification)'
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
			description: 'Timeout for bucket operations',
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
			placeholder: '# .gitignore format\n*.txt',
			description: 'Paths to ignore when calculating artifact checksum'
		}
	]
};
