export interface ResourceTemplate {
	id: string;
	name: string;
	description: string;
	kind: string;
	group: string;
	version: string;
	yaml: string;
	fields: TemplateField[];
	sections?: TemplateSection[];
	category?: string; // Added for categorization
	plural: string; // API plural form (e.g., 'gitrepositories', 'helmcharts')
}

export interface TemplateField {
	name: string;
	label: string;
	path: string; // JSON path or similar to update the YAML
	type: 'string' | 'number' | 'boolean' | 'select' | 'duration' | 'textarea' | 'array' | 'object';
	default?: string | number | boolean | unknown[];
	options?: { label: string; value: string }[];
	required?: boolean;
	description?: string;
	section?: string; // Section grouping for fields
	placeholder?: string;
	showIf?: {
		field: string; // Name of field to check
		value: string | string[]; // Value(s) that trigger visibility
	};
	validation?: {
		pattern?: string; // Regex pattern
		message?: string; // Custom error message
		min?: number; // Min value (for numbers)
		max?: number; // Max value (for numbers)
	};
	arrayItemType?: 'string' | 'object'; // For array fields
	arrayItemFields?: TemplateField[]; // For object array items
	objectFields?: TemplateField[]; // For object fields
	helpText?: string; // Detailed help text for the field
	docsUrl?: string; // Link to FluxCD documentation
	virtual?: boolean; // UI-only field, do not persist to YAML
}

export interface TemplateSection {
	id: string;
	title: string;
	description?: string;
	collapsible?: boolean;
	defaultExpanded?: boolean;
}

export const GIT_REPOSITORY_TEMPLATE: ResourceTemplate = {
	id: 'git-repository-base',
	name: 'Git Repository',
	description: 'Sources from a Git repository',
	kind: 'GitRepository',
	group: 'source.toolkit.fluxcd.io',
	version: 'v1',
	category: 'sources',
	plural: 'gitrepositories',
	yaml: `apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/org/repo
  ref:
    branch: main`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'source',
			title: 'Source Configuration',
			description: 'Git repository source settings',
			defaultExpanded: true
		},
		{
			id: 'auth',
			title: 'Authentication',
			description: 'Credentials and access control',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'verification',
			title: 'Verification',
			description: 'GPG signature verification settings',
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
			placeholder: 'my-repository',
			description: 'Unique name for this GitRepository resource',
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

		// Source Configuration
		{
			name: 'url',
			label: 'Repository URL',
			path: 'spec.url',
			type: 'string',
			required: true,
			section: 'source',
			placeholder: 'https://github.com/fluxcd/flux2',
			description: 'Git repository URL (https://, ssh://, or git@)',
			helpText:
				'The Git repository URL to sync from. Supports HTTPS (with optional basic auth), SSH (requires secretRef), and GitHub App authentication.',
			docsUrl: 'https://fluxcd.io/flux/components/source/gitrepositories/#url',
			validation: {
				pattern: '^(https?://|ssh://|git@)',
				message: 'URL must start with https://, http://, ssh://, or git@'
			}
		},
		{
			name: 'provider',
			label: 'Git Provider',
			path: 'spec.provider',
			type: 'select',
			section: 'source',
			default: 'generic',
			options: [
				{ label: 'Generic Git', value: 'generic' },
				{ label: 'GitHub', value: 'github' },
				{ label: 'Azure DevOps', value: 'azure' }
			],
			description: 'Git provider optimization'
		},
		{
			name: 'refType',
			label: 'Reference Type',
			path: 'spec.ref.type',
			type: 'select',
			section: 'source',
			default: 'branch',
			options: [
				{ label: 'Branch', value: 'branch' },
				{ label: 'Tag', value: 'tag' },
				{ label: 'Semver', value: 'semver' },
				{ label: 'Commit', value: 'commit' }
			],
			description: 'Type of Git reference to track'
		},
		{
			name: 'branch',
			label: 'Branch',
			path: 'spec.ref.branch',
			type: 'string',
			required: true,
			section: 'source',
			default: 'main',
			placeholder: 'main',
			description: 'Branch name to track',
			showIf: {
				field: 'refType',
				value: 'branch'
			}
		},
		{
			name: 'tag',
			label: 'Tag',
			path: 'spec.ref.tag',
			type: 'string',
			required: true,
			section: 'source',
			placeholder: 'v1.0.0',
			description: 'Tag name to track',
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
			required: true,
			section: 'source',
			placeholder: '>=1.0.0',
			description: 'Semver range to track',
			showIf: {
				field: 'refType',
				value: 'semver'
			},
			validation: {
				pattern: '^[><=~^*]?[0-9]+\\.[0-9]+(\\.[0-9]+)?',
				message: 'Must be a valid semver constraint (e.g., >=1.0.0, ~1.2.0, ^2.0.0)'
			}
		},
		{
			name: 'commit',
			label: 'Commit SHA',
			path: 'spec.ref.commit',
			type: 'string',
			required: true,
			section: 'source',
			placeholder: 'abc123...',
			description: 'Specific commit SHA to track',
			showIf: {
				field: 'refType',
				value: 'commit'
			}
		},
		{
			name: 'interval',
			label: 'Sync Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'source',
			default: '1m',
			placeholder: '1m',
			description: 'How often to check for repository changes (e.g., 1m, 1m30s, 1h30m)',
			helpText:
				'The interval at which to check the upstream repository for changes. Flux supports: 1h30m, 5m, 30s, etc.',
			docsUrl: 'https://fluxcd.io/flux/components/source/gitrepositories/#interval',
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
			placeholder: 'git-credentials',
			description: 'Name of secret containing authentication credentials'
		},
		{
			name: 'serviceAccountName',
			label: 'Service Account',
			path: 'spec.serviceAccountName',
			type: 'string',
			section: 'auth',
			placeholder: 'git-controller',
			description: 'ServiceAccount for impersonation'
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

		// Verification
		{
			name: 'verifyMode',
			label: 'Verification Mode',
			path: 'spec.verify.mode',
			type: 'select',
			section: 'verification',
			default: '',
			options: [
				{ label: 'Disabled', value: '' },
				{ label: 'Head (branch)', value: 'HEAD' },
				{ label: 'Tag', value: 'Tag' },
				{ label: 'Tag and Head', value: 'TagAndHEAD' }
			],
			description: 'Which references to verify with GPG'
		},
		{
			name: 'verifySecret',
			label: 'Verification Secret',
			path: 'spec.verify.secretRef.name',
			type: 'string',
			required: true,
			section: 'verification',
			placeholder: 'git-pgp-public-keys',
			description: 'Secret containing GPG public keys for verification',
			showIf: {
				field: 'verifyMode',
				value: ['HEAD', 'Tag', 'TagAndHEAD']
			}
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
			name: 'timeout',
			label: 'Timeout',
			path: 'spec.timeout',
			type: 'duration',
			section: 'advanced',
			placeholder: '60s',
			description: 'Timeout for Git operations',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		},
		{
			name: 'recurseSubmodules',
			label: 'Recurse Submodules',
			path: 'spec.recurseSubmodules',
			type: 'boolean',
			section: 'advanced',
			default: false,
			description: 'Recursively clone Git submodules'
		},
		{
			name: 'sparseCheckout',
			label: 'Sparse Checkout',
			path: 'spec.sparseCheckout',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'string',
			placeholder: './dir1',
			description: 'List of directories to checkout'
		},
		{
			name: 'ignore',
			label: 'Ignore Paths',
			path: 'spec.ignore',
			type: 'textarea',
			section: 'advanced',
			placeholder: '# .gitignore format\n*.txt\n/temp/',
			description: 'Paths to ignore when calculating artifact checksum (.gitignore format)'
		},
		{
			name: 'include',
			label: 'Include Repositories',
			path: 'spec.include',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'repository',
					label: 'Repository',
					path: 'repository',
					type: 'string',
					required: true,
					placeholder: 'other-repo'
				},
				{
					name: 'toPath',
					label: 'To Path',
					path: 'toPath',
					type: 'string',
					placeholder: './included'
				},
				{
					name: 'fromPath',
					label: 'From Path',
					path: 'fromPath',
					type: 'string',
					placeholder: './'
				}
			],
			description: 'Additional Git repositories to include'
		}
	]
};

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
			name: 'url',
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
			placeholder: '60s',
			description: 'Timeout for index download operations',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		}
	]
};

export const KUSTOMIZATION_TEMPLATE: ResourceTemplate = {
	id: 'kustomization-base',
	name: 'Kustomization',
	description: 'Deploys resources defined in a source via Kustomize',
	kind: 'Kustomization',
	group: 'kustomize.toolkit.fluxcd.io',
	version: 'v1',
	category: 'deployments',
	plural: 'kustomizations',
	yaml: `apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  path: ./deploy
  prune: true
  sourceRef:
    kind: GitRepository
    name: flux-system`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'source',
			title: 'Source Configuration',
			description: 'Source reference and path settings',
			defaultExpanded: true
		},
		{
			id: 'deployment',
			title: 'Deployment Settings',
			description: 'Reconciliation and deployment options',
			defaultExpanded: true
		},
		{
			id: 'health',
			title: 'Health Checks',
			description: 'Health assessment and wait configuration',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'advanced',
			title: 'Advanced Options',
			description: 'Additional configuration options',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'customization',
			title: 'Manifest Customization',
			description: 'Metadata and name overrides',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'remote',
			title: 'Remote Cluster & Decryption',
			description: 'KubeConfig and SOPS decryption',
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
			placeholder: 'my-app',
			description: 'Unique name for this Kustomization resource',
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

		// Source Configuration
		{
			name: 'sourceKind',
			label: 'Source Kind',
			path: 'spec.sourceRef.kind',
			type: 'select',
			required: true,
			section: 'source',
			default: 'GitRepository',
			options: [
				{ label: 'GitRepository', value: 'GitRepository' },
				{ label: 'OCIRepository', value: 'OCIRepository' },
				{ label: 'Bucket', value: 'Bucket' }
			],
			description: 'Type of source to reconcile from'
		},
		{
			name: 'sourceName',
			label: 'Source Name',
			path: 'spec.sourceRef.name',
			type: 'string',
			required: true,
			section: 'source',
			placeholder: 'flux-system',
			description: 'Name of the source resource'
		},
		{
			name: 'sourceNamespace',
			label: 'Source Namespace',
			path: 'spec.sourceRef.namespace',
			type: 'string',
			section: 'source',
			placeholder: 'flux-system',
			description: 'Namespace of the source (if different from this resource)'
		},
		{
			name: 'path',
			label: 'Path',
			path: 'spec.path',
			type: 'string',
			section: 'source',
			default: './',
			placeholder: './deploy',
			description: 'Path to the directory containing Kustomize files'
		},

		// Deployment Settings
		{
			name: 'interval',
			label: 'Sync Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'deployment',
			default: '5m',
			placeholder: '5m',
			description: 'How often to reconcile the Kustomization',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message:
					'Duration must use time units like: 1m (minutes), 30s (seconds), 1h (hours), or combined like 1h30m'
			}
		},
		{
			name: 'prune',
			label: 'Prune Resources',
			path: 'spec.prune',
			type: 'boolean',
			section: 'deployment',
			default: true,
			description: 'Delete resources removed from source'
		},
		{
			name: 'deletionPolicy',
			label: 'Deletion Policy',
			path: 'spec.deletionPolicy',
			type: 'select',
			section: 'deployment',
			default: 'MirrorPrune',
			options: [
				{ label: 'Mirror Prune', value: 'MirrorPrune' },
				{ label: 'Delete', value: 'Delete' },
				{ label: 'Wait For Termination', value: 'WaitForTermination' },
				{ label: 'Orphan', value: 'Orphan' }
			],
			description: 'Control garbage collection when Kustomization is deleted'
		},
		{
			name: 'targetNamespace',
			label: 'Target Namespace',
			path: 'spec.targetNamespace',
			type: 'string',
			section: 'deployment',
			placeholder: 'default',
			description: 'Override namespace for all resources'
		},
		{
			name: 'dependsOn',
			label: 'Dependencies',
			path: 'spec.dependsOn',
			type: 'array',
			section: 'deployment',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'name',
					label: 'Name',
					path: 'name',
					type: 'string',
					required: true,
					placeholder: 'common'
				},
				{
					name: 'namespace',
					label: 'Namespace',
					path: 'namespace',
					type: 'string',
					placeholder: 'flux-system'
				}
			],
			description: 'List of Kustomizations this depends on'
		},

		// Health Checks
		{
			name: 'wait',
			label: 'Wait for Resources',
			path: 'spec.wait',
			type: 'boolean',
			section: 'health',
			default: false,
			description: 'Wait for all resources to become ready'
		},
		{
			name: 'healthChecks',
			label: 'Health Checks',
			path: 'spec.healthChecks',
			type: 'array',
			section: 'health',
			arrayItemType: 'object',
			arrayItemFields: [
				{ name: 'kind', label: 'Kind', path: 'kind', type: 'string', required: true },
				{ name: 'name', label: 'Name', path: 'name', type: 'string', required: true },
				{ name: 'namespace', label: 'Namespace', path: 'namespace', type: 'string' }
			],
			description: 'List of resources to be included in health assessment'
		},
		{
			name: 'healthCheckExprs',
			label: 'Health Check Expressions (CEL)',
			path: 'spec.healthCheckExprs',
			type: 'array',
			section: 'health',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'apiVersion',
					label: 'API Version',
					path: 'apiVersion',
					type: 'string',
					required: true
				},
				{ name: 'kind', label: 'Kind', path: 'kind', type: 'string', required: true },
				{
					name: 'inProgress',
					label: 'In Progress Expression',
					path: 'inProgress',
					type: 'textarea',
					description: 'CEL expression to check if the resource is still progressing'
				},
				{
					name: 'failed',
					label: 'Failed Expression',
					path: 'failed',
					type: 'textarea',
					description: 'CEL expression to check if the resource has failed'
				},
				{
					name: 'current',
					label: 'Current Expression',
					path: 'current',
					type: 'textarea',
					required: true,
					description: 'CEL expression to check if the resource is healthy'
				}
			],
			description: 'CEL expressions for health assessment. Evaluation order: inProgress → failed → current',
			helpText: 'CEL expressions evaluated in order: inProgress (progressing), failed (unhealthy), current (healthy).'
		},
		{
			name: 'timeout',
			label: 'Timeout',
			path: 'spec.timeout',
			type: 'duration',
			section: 'health',
			placeholder: '5m',
			description: 'Timeout for health checks and operations',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
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
			name: 'force',
			label: 'Force Apply',
			path: 'spec.force',
			type: 'boolean',
			section: 'advanced',
			default: false,
			description: 'Force resource updates through delete/recreate if needed'
		},
		{
			name: 'serviceAccountName',
			label: 'Service Account',
			path: 'spec.serviceAccountName',
			type: 'string',
			section: 'advanced',
			placeholder: 'kustomize-controller',
			description: 'ServiceAccount to impersonate for reconciliation'
		},
		{
			name: 'retryInterval',
			label: 'Retry Interval',
			path: 'spec.retryInterval',
			type: 'duration',
			section: 'advanced',
			placeholder: '1m',
			description: 'How often to retry after a failure',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		},
		{
			name: 'components',
			label: 'Components',
			path: 'spec.components',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'string',
			placeholder: './components/feature-a',
			description: 'List of Kustomize components'
		},
		{
			name: 'ignoreMissingComponents',
			label: 'Ignore Missing Components',
			path: 'spec.ignoreMissingComponents',
			type: 'boolean',
			section: 'advanced',
			default: false,
			description: 'Ignore component paths not found in source'
		},
		{
			name: 'commonMetadataLabels',
			label: 'Common Labels',
			path: 'spec.commonMetadata.labels',
			type: 'textarea',
			section: 'customization',
			placeholder: 'app: my-app\nenv: prod',
			description: 'Labels to apply to all resources (YAML format)'
		},
		{
			name: 'commonMetadataAnnotations',
			label: 'Common Annotations',
			path: 'spec.commonMetadata.annotations',
			type: 'textarea',
			section: 'customization',
			placeholder: 'team: frontend',
			description: 'Annotations to apply to all resources (YAML format)'
		},
		{
			name: 'namePrefix',
			label: 'Name Prefix',
			path: 'spec.namePrefix',
			type: 'string',
			section: 'customization',
			placeholder: 'prod-',
			description: 'Prefix to add to all resource names'
		},
		{
			name: 'nameSuffix',
			label: 'Name Suffix',
			path: 'spec.nameSuffix',
			type: 'string',
			section: 'customization',
			placeholder: '-v1',
			description: 'Suffix to add to all resource names'
		},
		{
			name: 'postBuildSubstitute',
			label: 'Variable Substitution',
			path: 'spec.postBuild.substitute',
			type: 'textarea',
			section: 'customization',
			placeholder: 'cluster_name: prod-cluster',
			description: 'Key-value pairs for variable substitution (YAML format)'
		},
		{
			name: 'kubeConfigSecret',
			label: 'Remote KubeConfig Secret',
			path: 'spec.kubeConfig.secretRef.name',
			type: 'string',
			section: 'remote',
			placeholder: 'remote-cluster-kubeconfig',
			description: 'Secret containing KubeConfig for remote cluster'
		},
		{
			name: 'decryptionProvider',
			label: 'Decryption Provider',
			path: 'spec.decryption.provider',
			type: 'select',
			section: 'remote',
			default: '',
			options: [
				{ label: 'None', value: '' },
				{ label: 'SOPS', value: 'sops' }
			],
			description: 'Provider for Secrets decryption'
		},
		{
			name: 'decryptionSecret',
			label: 'Decryption Secret',
			path: 'spec.decryption.secretRef.name',
			type: 'string',
			section: 'remote',
			placeholder: 'sops-gpg',
			description: 'Secret containing decryption keys',
			showIf: {
				field: 'decryptionProvider',
				value: 'sops'
			}
		},
		{
			name: 'images',
			label: 'Images',
			path: 'spec.images',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'name',
					label: 'Original Name',
					path: 'name',
					type: 'string',
					required: true,
					placeholder: 'ghcr.io/stefanprodan/podinfo'
				},
				{
					name: 'newName',
					label: 'New Name',
					path: 'newName',
					type: 'string',
					placeholder: 'registry.example.com/podinfo'
				},
				{
					name: 'newTag',
					label: 'New Tag',
					path: 'newTag',
					type: 'string',
					placeholder: 'v1.0.0'
				},
				{
					name: 'digest',
					label: 'Digest',
					path: 'digest',
					type: 'string',
					placeholder: 'sha256:...'
				}
			],
			description: 'Override container images'
		},
		{
			name: 'patches',
			label: 'Strategic Merge Patches',
			path: 'spec.patches',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'target',
					label: 'Target',
					path: 'target',
					type: 'textarea',
					placeholder: 'group: apps\nversion: v1\nkind: Deployment\nname: my-app'
				},
				{
					name: 'patch',
					label: 'Patch',
					path: 'patch',
					type: 'textarea',
					placeholder: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: my-app'
				}
			],
			description: 'Strategic merge patches to apply'
		}
	]
};

export const HELM_RELEASE_TEMPLATE: ResourceTemplate = {
	id: 'helm-release-base',
	name: 'Helm Release',
	description: 'Deploys a Helm chart',
	kind: 'HelmRelease',
	group: 'helm.toolkit.fluxcd.io',
	version: 'v2',
	category: 'deployments',
	plural: 'helmreleases',
	yaml: `apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  chart:
    spec:
      chart: podinfo
      version: ">=1.0.0"
      sourceRef:
        kind: HelmRepository
        name: bitnami
        namespace: flux-system`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'chart',
			title: 'Chart Configuration',
			description: 'Helm chart source and version',
			defaultExpanded: true
		},
		{
			id: 'release',
			title: 'Release Settings',
			description: 'Helm release configuration',
			defaultExpanded: true
		},
		{
			id: 'upgrade',
			title: 'Upgrade & Rollback',
			description: 'Upgrade and rollback behavior',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'advanced',
			title: 'Advanced Options',
			description: 'Additional configuration options',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'drift',
			title: 'Drift Detection',
			description: 'Drift detection and correction',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'install',
			title: 'Install Options',
			description: 'Helm install action configuration',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'test',
			title: 'Helm Test',
			description: 'Helm test action configuration',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'uninstall',
			title: 'Uninstall Options',
			description: 'Helm uninstall action configuration',
			collapsible: true,
			defaultExpanded: false
		},
		{
			id: 'remote',
			title: 'Remote Cluster',
			description: 'KubeConfig for remote cluster',
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
			placeholder: 'my-release',
			description: 'Unique name for this HelmRelease resource',
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

		// Chart Configuration
		{
			name: 'chartSourceKind',
			label: 'Chart Source Kind',
			path: 'spec.chart.spec.sourceRef.kind',
			type: 'select',
			required: true,
			section: 'chart',
			default: 'HelmRepository',
			options: [
				{ label: 'HelmRepository', value: 'HelmRepository' },
				{ label: 'GitRepository', value: 'GitRepository' },
				{ label: 'Bucket', value: 'Bucket' }
			],
			description: 'Type of source containing the chart'
		},
		{
			name: 'chartSourceName',
			label: 'Chart Source Name',
			path: 'spec.chart.spec.sourceRef.name',
			type: 'string',
			required: true,
			section: 'chart',
			placeholder: 'bitnami',
			description: 'Name of the source resource'
		},
		{
			name: 'chartSourceNamespace',
			label: 'Chart Source Namespace',
			path: 'spec.chart.spec.sourceRef.namespace',
			type: 'string',
			section: 'chart',
			placeholder: 'flux-system',
			description: 'Namespace of the chart source'
		},
		{
			name: 'chartName',
			label: 'Chart Name',
			path: 'spec.chart.spec.chart',
			type: 'string',
			required: true,
			section: 'chart',
			placeholder: 'podinfo',
			description: 'Name of the Helm chart'
		},
		{
			name: 'chartVersion',
			label: 'Chart Version',
			path: 'spec.chart.spec.version',
			type: 'string',
			section: 'chart',
			default: '*',
			placeholder: '>=1.0.0 <2.0.0',
			description: 'SemVer version constraint or specific version'
		},

		// Release Settings
		{
			name: 'interval',
			label: 'Sync Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'release',
			default: '5m',
			placeholder: '5m',
			description: 'How often to reconcile the release',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message:
					'Duration must use time units like: 1m (minutes), 30s (seconds), 1h (hours), or combined like 1h30m'
			}
		},
		{
			name: 'targetNamespace',
			label: 'Target Namespace',
			path: 'spec.targetNamespace',
			type: 'string',
			section: 'release',
			placeholder: 'default',
			description: 'Namespace to install the release into'
		},
		{
			name: 'storageNamespace',
			label: 'Storage Namespace',
			path: 'spec.storageNamespace',
			type: 'string',
			section: 'release',
			placeholder: 'flux-system',
			description: 'Namespace where Helm stores release state'
		},
		{
			name: 'releaseName',
			label: 'Release Name',
			path: 'spec.releaseName',
			type: 'string',
			section: 'release',
			placeholder: 'my-app',
			description: 'Helm release name (defaults to metadata.name)'
		},
		{
			name: 'values',
			label: 'Values',
			path: 'spec.values',
			type: 'textarea',
			section: 'release',
			placeholder: 'replicaCount: 3\nimage:\n  tag: v1.0.0',
			description: 'Helm values to override (YAML format)'
		},
		{
			name: 'valuesFrom',
			label: 'Values From',
			path: 'spec.valuesFrom',
			type: 'array',
			section: 'release',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'kind',
					label: 'Kind',
					path: 'kind',
					type: 'select',
					options: [
						{ label: 'ConfigMap', value: 'ConfigMap' },
						{ label: 'Secret', value: 'Secret' }
					]
				},
				{ name: 'name', label: 'Name', path: 'name', type: 'string' },
				{ name: 'valuesKey', label: 'Values Key', path: 'valuesKey', type: 'string' },
				{ name: 'targetPath', label: 'Target Path', path: 'targetPath', type: 'string' },
				{ name: 'optional', label: 'Optional', path: 'optional', type: 'boolean' }
			],
			description: 'References to ConfigMaps or Secrets for values'
		},
		{
			name: 'dependsOn',
			label: 'Dependencies',
			path: 'spec.dependsOn',
			type: 'array',
			section: 'release',
			arrayItemType: 'object',
			arrayItemFields: [
				{ name: 'name', label: 'Name', path: 'name', type: 'string' },
				{ name: 'namespace', label: 'Namespace', path: 'namespace', type: 'string' }
			],
			description: 'List of HelmReleases this depends on'
		},
		{
			name: 'commonMetadataLabels',
			label: 'Common Labels',
			path: 'spec.commonMetadata.labels',
			type: 'textarea',
			section: 'release',
			placeholder: 'app: my-app',
			description: 'Labels to apply to all resources'
		},
		{
			name: 'commonMetadataAnnotations',
			label: 'Common Annotations',
			path: 'spec.commonMetadata.annotations',
			type: 'textarea',
			section: 'release',
			placeholder: 'team: frontend',
			description: 'Annotations to apply to all resources'
		},

		// Upgrade & Rollback
		{
			name: 'upgradeForce',
			label: 'Force Upgrade',
			path: 'spec.upgrade.force',
			type: 'boolean',
			section: 'upgrade',
			default: false,
			description: 'Force resource updates through delete/recreate'
		},
		{
			name: 'upgradeCleanupOnFail',
			label: 'Cleanup on Fail',
			path: 'spec.upgrade.cleanupOnFail',
			type: 'boolean',
			section: 'upgrade',
			default: true,
			description: 'Delete resources created during failed upgrade'
		},
		{
			name: 'rollbackCleanupOnFail',
			label: 'Cleanup on Rollback Fail',
			path: 'spec.rollback.cleanupOnFail',
			type: 'boolean',
			section: 'upgrade',
			default: true,
			description: 'Delete resources created during failed rollback'
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
			placeholder: '5m',
			description: 'Timeout for Helm operations',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		},
		{
			name: 'serviceAccountName',
			label: 'Service Account',
			path: 'spec.serviceAccountName',
			type: 'string',
			section: 'advanced',
			placeholder: 'helm-controller',
			description: 'ServiceAccount to impersonate for Helm operations'
		},
		{
			name: 'persistentClient',
			label: 'Persistent Client',
			path: 'spec.persistentClient',
			type: 'boolean',
			section: 'advanced',
			default: true,
			description: 'Use a persistent Kubernetes client for this release'
		},
		{
			name: 'maxHistory',
			label: 'Max History',
			path: 'spec.maxHistory',
			type: 'number',
			section: 'advanced',
			default: 5,
			description: 'Max number of release revisions to keep'
		},
		{
			name: 'driftMode',
			label: 'Drift Detection Mode',
			path: 'spec.driftDetection.mode',
			type: 'select',
			section: 'drift',
			default: 'warn',
			options: [
				{ label: 'Disabled', value: 'disabled' },
				{ label: 'Warn', value: 'warn' },
				{ label: 'Enabled (Automatic Correction)', value: 'enabled' }
			],
			description: 'Mode for drift detection and correction'
		},
		{
			name: 'installCRDs',
			label: 'Install CRDs',
			path: 'spec.install.crds',
			type: 'select',
			section: 'install',
			default: 'Create',
			options: [
				{ label: 'Skip', value: 'Skip' },
				{ label: 'Create', value: 'Create' },
				{ label: 'CreateReplace', value: 'CreateReplace' }
			]
		},
		{
			name: 'createNamespace',
			label: 'Create Namespace',
			path: 'spec.install.createNamespace',
			type: 'boolean',
			section: 'install',
			default: false,
			description: 'Create target namespace if it does not exist'
		},
		{
			name: 'testEnabled',
			label: 'Enable Helm Test',
			path: 'spec.test.enable',
			type: 'boolean',
			section: 'test',
			default: false,
			description: 'Run helm test after install/upgrade'
		},
		{
			name: 'uninstallKeepHistory',
			label: 'Keep History on Uninstall',
			path: 'spec.uninstall.keepHistory',
			type: 'boolean',
			section: 'uninstall',
			default: false,
			description: 'Retain release history after uninstall'
		},
		{
			name: 'kubeConfigSecret',
			label: 'Remote KubeConfig Secret',
			path: 'spec.kubeConfig.secretRef.name',
			type: 'string',
			section: 'remote',
			placeholder: 'remote-cluster-kubeconfig',
			description: 'Secret containing KubeConfig for remote cluster'
		},
		{
			name: 'postRenderers',
			label: 'Post Renderers',
			path: 'spec.postRenderers',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'kustomize',
					label: 'Kustomize Config',
					path: 'kustomize',
					type: 'textarea',
					placeholder: 'patches:\n  - target:\n      group: apps'
				}
			],
			description: 'Post-renderers to apply to rendered manifests'
		}
	]
};

export const HELM_CHART_TEMPLATE: ResourceTemplate = {
	id: 'helm-chart-base',
	name: 'Helm Chart',
	description: 'References a Helm chart from a repository',
	kind: 'HelmChart',
	group: 'source.toolkit.fluxcd.io',
	version: 'v1',
	category: 'sources',
	plural: 'helmcharts',
	yaml: `apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmChart
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  chart: podinfo
  version: ">=1.0.0"
  sourceRef:
    kind: HelmRepository
    name: podinfo`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'chart',
			title: 'Chart Configuration',
			description: 'Chart source and version',
			defaultExpanded: true
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
			placeholder: 'my-chart',
			description: 'Unique name for this HelmChart resource',
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

		// Chart Configuration
		{
			name: 'sourceKind',
			label: 'Source Kind',
			path: 'spec.sourceRef.kind',
			type: 'select',
			required: true,
			section: 'chart',
			default: 'HelmRepository',
			options: [
				{ label: 'HelmRepository', value: 'HelmRepository' },
				{ label: 'GitRepository', value: 'GitRepository' },
				{ label: 'Bucket', value: 'Bucket' }
			],
			description: 'Type of source containing the chart'
		},
		{
			name: 'sourceName',
			label: 'Source Name',
			path: 'spec.sourceRef.name',
			type: 'string',
			required: true,
			section: 'chart',
			placeholder: 'podinfo',
			description: 'Name of the source resource'
		},
		{
			name: 'chart',
			label: 'Chart Name',
			path: 'spec.chart',
			type: 'string',
			required: true,
			section: 'chart',
			placeholder: 'podinfo',
			description: 'Name of the Helm chart'
		},
		{
			name: 'version',
			label: 'Chart Version',
			path: 'spec.version',
			type: 'string',
			section: 'chart',
			default: '*',
			placeholder: '>=1.0.0',
			description: 'SemVer version constraint'
		},
		{
			name: 'reconcileStrategy',
			label: 'Reconcile Strategy',
			path: 'spec.reconcileStrategy',
			type: 'select',
			section: 'chart',
			default: 'ChartVersion',
			options: [
				{ label: 'Chart Version', value: 'ChartVersion' },
				{ label: 'Revision', value: 'Revision' }
			],
			description: 'What enables the creation of a new artifact'
		},
		{
			name: 'interval',
			label: 'Sync Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'chart',
			default: '5m',
			placeholder: '5m',
			description: 'How often to check for new chart versions',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message:
					'Duration must use time units like: 1m (minutes), 30s (seconds), 1h (hours), or combined like 1h30m'
			}
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
			name: 'valuesFiles',
			label: 'Values Files',
			path: 'spec.valuesFiles',
			type: 'textarea',
			section: 'advanced',
			placeholder: '- values.yaml\n- values-prod.yaml',
			description: 'List of values files to merge (YAML array format)'
		},
		{
			name: 'ignoreMissingValuesFiles',
			label: 'Ignore Missing Values Files',
			path: 'spec.ignoreMissingValuesFiles',
			type: 'boolean',
			section: 'advanced',
			default: false,
			description: 'Silently ignore missing values files rather than failing'
		}
	]
};

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

export const OCI_REPOSITORY_TEMPLATE: ResourceTemplate = {
	id: 'oci-repository-base',
	name: 'OCI Repository',
	description: 'Sources from an OCI registry',
	kind: 'OCIRepository',
	group: 'source.toolkit.fluxcd.io',
	version: 'v1beta2',
	category: 'sources',
	plural: 'ocirepositories',
	yaml: `apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  url: oci://ghcr.io/org/manifests
  ref:
    tag: latest`,
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
			default: 'latest',
			placeholder: 'latest',
			description: 'Tag to track',
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
				pattern: '^[><=~^*]?[0-9]+\\.[0-9]+(\\.[0-9]+)?',
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

export const ALERT_TEMPLATE: ResourceTemplate = {
	id: 'alert-base',
	name: 'Alert',
	description: 'Sends notifications for FluxCD events',
	kind: 'Alert',
	group: 'notification.toolkit.fluxcd.io',
	version: 'v1beta3',
	category: 'notifications',
	plural: 'alerts',
	yaml: `apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: example
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: info
  eventSources:
    - kind: GitRepository
      name: '*'
    - kind: Kustomization
      name: '*'`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'notification',
			title: 'Notification Settings',
			description: 'Provider and severity configuration',
			defaultExpanded: true
		},
		{
			id: 'advanced',
			title: 'Advanced Options',
			description: 'Event filtering and summary',
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
			placeholder: 'my-alert',
			description: 'Unique name for this Alert resource',
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

		// Notification Settings
		{
			name: 'providerName',
			label: 'Provider Name',
			path: 'spec.providerRef.name',
			type: 'string',
			required: true,
			section: 'notification',
			placeholder: 'slack',
			description: 'Name of the Provider resource to send notifications to'
		},
		{
			name: 'eventSources',
			label: 'Event Sources',
			path: 'spec.eventSources',
			type: 'array',
			required: true,
			section: 'notification',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'kind',
					label: 'Kind',
					path: 'kind',
					type: 'string',
					required: true,
					placeholder: 'GitRepository',
					description: 'Resource kind (e.g., GitRepository, Kustomization)'
				},
				{
					name: 'name',
					label: 'Name',
					path: 'name',
					type: 'string',
					required: true,
					placeholder: '* or resource name',
					description: 'Resource name; use * to watch all resources of that kind'
				}
			],
			placeholder: 'GitRepository',
			description:
				'Resources to monitor for events. Use * for name to watch all resources of that kind.',
			helpText:
				'Define which FluxCD resources to monitor. Each entry needs a kind (e.g., GitRepository, Kustomization) and name (use * for all).',
			docsUrl: 'https://fluxcd.io/flux/components/notification/alerts/#event-sources'
		},
		{
			name: 'eventSeverity',
			label: 'Event Severity',
			path: 'spec.eventSeverity',
			type: 'select',
			section: 'notification',
			default: 'info',
			options: [
				{ label: 'Info (all events)', value: 'info' },
				{ label: 'Error (only errors)', value: 'error' }
			],
			description: 'Minimum severity level to trigger alerts'
		},

		// Advanced Options
		{
			name: 'suspend',
			label: 'Suspend',
			path: 'spec.suspend',
			type: 'boolean',
			section: 'advanced',
			default: false,
			description: 'Suspend sending notifications'
		},
		{
			name: 'summary',
			label: 'Summary',
			path: 'spec.summary',
			type: 'string',
			section: 'advanced',
			placeholder: 'Production cluster alerts',
			description:
				'Optional summary to include in notifications (Deprecated: use Event Metadata instead)'
		},
		{
			name: 'eventMetadata',
			label: 'Event Metadata',
			path: 'spec.eventMetadata',
			type: 'textarea',
			section: 'advanced',
			placeholder: 'cluster: prod-1\nenv: production',
			description: 'Additional metadata to include in alerts (YAML format)'
		},
		{
			name: 'inclusionList',
			label: 'Inclusion List',
			path: 'spec.inclusionList',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'string',
			placeholder: 'Succeeded',
			description: 'Specific events to include (if empty, all events are included)'
		},
		{
			name: 'exclusionList',
			label: 'Exclusion List',
			path: 'spec.exclusionList',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'string',
			placeholder: 'Progressing',
			description: 'Events to exclude from notifications'
		}
	]
};

export const PROVIDER_TEMPLATE: ResourceTemplate = {
	id: 'provider-base',
	name: 'Provider',
	description: 'Configures a notification provider',
	kind: 'Provider',
	group: 'notification.toolkit.fluxcd.io',
	version: 'v1beta3',
	category: 'notifications',
	plural: 'providers',
	yaml: `apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: slack
  namespace: flux-system
spec:
  type: slack
  channel: general
  secretRef:
    name: slack-webhook-url`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'provider',
			title: 'Provider Configuration',
			description: 'Notification provider settings',
			defaultExpanded: true
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
			placeholder: 'slack',
			description: 'Unique name for this Provider resource',
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

		// Provider Configuration
		{
			name: 'type',
			label: 'Provider Type',
			path: 'spec.type',
			type: 'select',
			required: true,
			section: 'provider',
			default: 'slack',
			options: [
				{ label: 'Slack', value: 'slack' },
				{ label: 'Discord', value: 'discord' },
				{ label: 'Microsoft Teams', value: 'msteams' },
				{ label: 'Generic Webhook', value: 'generic' },
				{ label: 'GitHub', value: 'github' },
				{ label: 'GitLab', value: 'gitlab' }
			],
			description: 'Type of notification provider'
		},
		{
			name: 'channel',
			label: 'Channel',
			path: 'spec.channel',
			type: 'string',
			section: 'provider',
			placeholder: 'general',
			description: 'Channel name (for Slack, Discord, etc.)'
		},
		{
			name: 'username',
			label: 'Username',
			path: 'spec.username',
			type: 'string',
			section: 'provider',
			placeholder: 'FluxCD Bot',
			description: 'Override username for notifications'
		},
		{
			name: 'secretName',
			label: 'Secret Name',
			path: 'spec.secretRef.name',
			type: 'string',
			section: 'provider',
			placeholder: 'slack-webhook-url',
			description: 'Secret containing webhook URL or credentials (if not using inline address)'
		},
		{
			name: 'address',
			label: 'Address',
			path: 'spec.address',
			type: 'string',
			section: 'provider',
			placeholder: 'https://hooks.slack.com/services/...',
			description: 'Webhook URL or API address (if not in secret)'
		},
		{
			name: 'proxy',
			label: 'Proxy',
			path: 'spec.proxy',
			type: 'string',
			section: 'provider',
			placeholder: 'http://proxy.example.com:8080',
			description: 'Proxy address to use for notifications'
		},
		{
			name: 'tlsCertSecret',
			label: 'TLS Certificate Secret',
			path: 'spec.certSecretRef.name',
			type: 'string',
			section: 'provider',
			placeholder: 'tls-cert',
			description: 'Secret containing TLS certificate'
		},
		{
			name: 'proxySecretRef',
			label: 'Proxy Secret',
			path: 'spec.proxySecretRef.name',
			type: 'string',
			section: 'provider',
			placeholder: 'proxy-credentials',
			description: 'Secret containing proxy credentials'
		},
		{
			name: 'timeout',
			label: 'Timeout',
			path: 'spec.timeout',
			type: 'duration',
			section: 'provider',
			placeholder: '30s',
			description: 'Timeout for sending notifications',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		},
		{
			name: 'suspend',
			label: 'Suspend',
			path: 'spec.suspend',
			type: 'boolean',
			section: 'provider',
			default: false,
			description: 'Suspend notifications'
		},
		{
			name: 'serviceAccountName',
			label: 'Service Account',
			path: 'spec.serviceAccountName',
			type: 'string',
			section: 'provider',
			placeholder: 'notification-controller',
			description: 'ServiceAccount for cloud provider authentication'
		},
		{
			name: 'commitStatusExpr',
			label: 'Commit Status Expression',
			path: 'spec.commitStatusExpr',
			type: 'textarea',
			section: 'provider',
			placeholder: 'event.message',
			description: 'CEL expression for custom commit status message'
		}
	]
};

export const RECEIVER_TEMPLATE: ResourceTemplate = {
	id: 'receiver-base',
	name: 'Receiver',
	description: 'Webhook receiver for external events',
	kind: 'Receiver',
	group: 'notification.toolkit.fluxcd.io',
	version: 'v1',
	category: 'notifications',
	plural: 'receivers',
	yaml: `apiVersion: notification.toolkit.fluxcd.io/v1
kind: Receiver
metadata:
  name: example
  namespace: flux-system
spec:
  type: github
  events:
    - "ping"
    - "push"
  secretRef:
    name: webhook-token
  resources:
    - kind: GitRepository
      name: webapp`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'receiver',
			title: 'Receiver Configuration',
			description: 'Webhook receiver settings',
			defaultExpanded: true
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
			placeholder: 'github-receiver',
			description: 'Unique name for this Receiver resource',
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

		// Receiver Configuration
		{
			name: 'type',
			label: 'Receiver Type',
			path: 'spec.type',
			type: 'select',
			required: true,
			section: 'receiver',
			default: 'github',
			options: [
				{ label: 'GitHub', value: 'github' },
				{ label: 'GitLab', value: 'gitlab' },
				{ label: 'Bitbucket', value: 'bitbucket' },
				{ label: 'Harbor', value: 'harbor' },
				{ label: 'Generic', value: 'generic' }
			],
			description: 'Type of webhook receiver'
		},
		{
			name: 'resources',
			label: 'Resources',
			path: 'spec.resources',
			type: 'array',
			required: true,
			section: 'receiver',
			arrayItemType: 'object',
			arrayItemFields: [
				{
					name: 'kind',
					label: 'Kind',
					path: 'kind',
					type: 'string',
					required: true,
					placeholder: 'GitRepository',
					description: 'Resource kind (e.g., GitRepository, Kustomization)'
				},
				{
					name: 'name',
					label: 'Name',
					path: 'name',
					type: 'string',
					required: true,
					placeholder: '* or resource name',
					description: 'Resource name; use * to watch all resources of that kind'
				}
			],
			placeholder: 'GitRepository',
			description:
				'FluxCD resources to reconcile when webhook is triggered. Use * for name to reconcile all resources of that kind.',
			helpText:
				'Define which resources should be reconciled when this webhook receives an event. Each entry needs a kind (e.g., GitRepository, HelmRelease) and name (use * for all).',
			docsUrl: 'https://fluxcd.io/flux/components/notification/receivers/#resources'
		},
		{
			name: 'events',
			label: 'Events',
			path: 'spec.events',
			type: 'array',
			section: 'receiver',
			arrayItemType: 'string',
			placeholder: 'push',
			description: 'Specific events to receive (if empty, all events are received)'
		},
		{
			name: 'secretName',
			label: 'Secret Name',
			path: 'spec.secretRef.name',
			type: 'string',
			required: true,
			section: 'receiver',
			placeholder: 'webhook-token',
			description: 'Secret containing webhook validation token'
		},
		{
			name: 'interval',
			label: 'Interval',
			path: 'spec.interval',
			type: 'duration',
			section: 'receiver',
			placeholder: '10m',
			description: 'Reconciliation interval',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		},
		{
			name: 'suspend',
			label: 'Suspend',
			path: 'spec.suspend',
			type: 'boolean',
			section: 'receiver',
			default: false,
			description: 'Suspend webhook processing'
		}
	]
};

export const IMAGE_REPOSITORY_TEMPLATE: ResourceTemplate = {
	id: 'image-repository-base',
	name: 'Image Repository',
	description: 'Scans container image repositories',
	kind: 'ImageRepository',
	group: 'image.toolkit.fluxcd.io',
	version: 'v1beta2',
	category: 'image-automation',
	plural: 'imagerepositories',
	yaml: `apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  image: ghcr.io/org/app`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'repository',
			title: 'Repository Settings',
			description: 'Container registry and scan configuration',
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
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			section: 'basic',
			placeholder: 'my-app',
			description: 'Unique name for this ImageRepository resource',
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
			validation: {
				pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
				message:
					'Namespace must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)'
			}
		},
		{
			name: 'image',
			label: 'Image',
			path: 'spec.image',
			type: 'string',
			required: true,
			section: 'repository',
			placeholder: 'ghcr.io/org/app',
			description: 'Container image repository to scan'
		},
		{
			name: 'provider',
			label: 'Registry Provider',
			path: 'spec.provider',
			type: 'select',
			section: 'repository',
			default: 'generic',
			options: [
				{ label: 'Generic', value: 'generic' },
				{ label: 'AWS', value: 'aws' },
				{ label: 'Azure', value: 'azure' },
				{ label: 'GCP', value: 'gcp' }
			],
			description: 'Cloud provider for registry authentication'
		},
		{
			name: 'interval',
			label: 'Scan Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'repository',
			default: '5m',
			description: 'How often to scan for new images',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message:
					'Duration must use time units like: 1m (minutes), 30s (seconds), 1h (hours), or combined like 1h30m'
			}
		},
		{
			name: 'timeout',
			label: 'Timeout',
			path: 'spec.timeout',
			type: 'duration',
			section: 'repository',
			placeholder: '60s',
			description: 'Timeout for scanning operations',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		},
		{
			name: 'insecure',
			label: 'Insecure',
			path: 'spec.insecure',
			type: 'boolean',
			section: 'repository',
			default: false,
			description: 'Allow insecure connections (skip TLS verification)'
		},
		{
			name: 'secretRefName',
			label: 'Secret Name',
			path: 'spec.secretRef.name',
			type: 'string',
			section: 'auth',
			placeholder: 'registry-credentials',
			description: 'Secret containing registry credentials'
		},
		{
			name: 'certSecretRef',
			label: 'TLS Secret',
			path: 'spec.certSecretRef.name',
			type: 'string',
			section: 'auth',
			placeholder: 'registry-tls-certs',
			description: 'Secret containing CA/cert/key for TLS authentication'
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
			name: 'serviceAccountName',
			label: 'Service Account',
			path: 'spec.serviceAccountName',
			type: 'string',
			section: 'advanced',
			placeholder: 'default',
			description: 'Service account to use for scanning images'
		},
		{
			name: 'exclusionList',
			label: 'Exclusion List',
			path: 'spec.exclusionList',
			type: 'array',
			section: 'advanced',
			arrayItemType: 'string',
			placeholder: '^.*\\.sig$',
			description: 'Regular expression patterns to exclude image tags'
		},
		{
			name: 'accessFrom',
			label: 'Access From Namespaces',
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
					placeholder: 'team: backend'
				}
			],
			description: 'Namespaces allowed to access this ImageRepository'
		},
		{
			name: 'suspend',
			label: 'Suspend',
			path: 'spec.suspend',
			type: 'boolean',
			section: 'repository',
			default: false,
			description: 'Suspend image scanning'
		}
	]
};

export const IMAGE_POLICY_TEMPLATE: ResourceTemplate = {
	id: 'image-policy-base',
	name: 'Image Policy',
	description: 'Defines policies for selecting image versions',
	kind: 'ImagePolicy',
	group: 'image.toolkit.fluxcd.io',
	version: 'v1beta2',
	category: 'image-automation',
	plural: 'imagepolicies',
	yaml: `apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: example
  namespace: flux-system
spec:
  imageRepositoryRef:
    name: example
  policy:
    semver:
      range: ">=1.0.0"`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'policy',
			title: 'Policy Configuration',
			description: 'Image selection policy',
			defaultExpanded: true
		}
	],
	fields: [
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			section: 'basic',
			placeholder: 'my-app-policy',
			description: 'Unique name for this ImagePolicy resource',
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
			validation: {
				pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
				message:
					'Namespace must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)'
			}
		},
		{
			name: 'imageRepositoryName',
			label: 'Image Repository',
			path: 'spec.imageRepositoryRef.name',
			type: 'string',
			required: true,
			section: 'policy',
			placeholder: 'my-app',
			description: 'Name of the ImageRepository to apply policy to'
		},
		{
			name: 'digestReflectionPolicy',
			label: 'Digest Reflection Policy',
			path: 'spec.digestReflectionPolicy',
			type: 'select',
			section: 'policy',
			default: 'Never',
			options: [
				{ label: 'Never', value: 'Never' },
				{ label: 'Always', value: 'Always' },
				{ label: 'If Not Present', value: 'IfNotPresent' }
			],
			description: 'Control how the digest is reflected in status'
		},
		{
			name: 'interval',
			label: 'Interval',
			path: 'spec.interval',
			type: 'duration',
			section: 'policy',
			placeholder: '10m',
			description: 'Refresh interval (only used when Digest Reflection Policy is Always)',
			showIf: {
				field: 'digestReflectionPolicy',
				value: 'Always'
			},
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message:
					'Duration must use time units like: 1m (minutes), 30s (seconds), 1h (hours), or combined like 1h30m'
			}
		},
		{
			name: 'policyType',
			label: 'Policy Type',
			path: 'spec.policy.type',
			type: 'select',
			section: 'policy',
			default: 'semver',
			options: [
				{ label: 'Semver', value: 'semver' },
				{ label: 'Alphabetical', value: 'alphabetical' },
				{ label: 'Numerical', value: 'numerical' }
			],
			description: 'Strategy for selecting image tags',
			virtual: true
		},
		{
			name: 'semverRange',
			label: 'Semver Range',
			path: 'spec.policy.semver.range',
			type: 'string',
			section: 'policy',
			default: '>=1.0.0',
			placeholder: '>=1.0.0 <2.0.0',
			description: 'Semver constraint',
			showIf: {
				field: 'policyType',
				value: 'semver'
			}
		},
		{
			name: 'alphabeticalOrder',
			label: 'Alphabetical Order',
			path: 'spec.policy.alphabetical.order',
			type: 'select',
			section: 'policy',
			default: 'asc',
			options: [
				{ label: 'Ascending', value: 'asc' },
				{ label: 'Descending', value: 'desc' }
			],
			showIf: {
				field: 'policyType',
				value: 'alphabetical'
			}
		},
		{
			name: 'numericalOrder',
			label: 'Numerical Order',
			path: 'spec.policy.numerical.order',
			type: 'select',
			section: 'policy',
			default: 'asc',
			options: [
				{ label: 'Ascending', value: 'asc' },
				{ label: 'Descending', value: 'desc' }
			],
			showIf: {
				field: 'policyType',
				value: 'numerical'
			}
		},
		{
			name: 'filterTagsPattern',
			label: 'Filter Tags Pattern',
			path: 'spec.filterTags.pattern',
			type: 'string',
			section: 'policy',
			placeholder: '^v(?P<version>.*)$',
			description: 'Regular expression to filter image tags'
		},
		{
			name: 'filterTagsExtract',
			label: 'Filter Tags Extract',
			path: 'spec.filterTags.extract',
			type: 'string',
			section: 'policy',
			placeholder: '$version',
			description: 'Extraction expression to get the version from the tag'
		}
	]
};

export const IMAGE_UPDATE_AUTOMATION_TEMPLATE: ResourceTemplate = {
	id: 'image-update-automation-base',
	name: 'Image Update Automation',
	description: 'Automates image updates to Git',
	kind: 'ImageUpdateAutomation',
	group: 'image.toolkit.fluxcd.io',
	version: 'v1beta2',
	category: 'image-automation',
	plural: 'imageupdateautomations',
	yaml: `apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageUpdateAutomation
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 30m
  sourceRef:
    kind: GitRepository
    name: flux-system
  git:
    checkout:
      ref:
        branch: main
    commit:
      author:
        email: fluxcdbot@example.com
        name: fluxcdbot
      messageTemplate: "Update image"
    push:
      branch: main
  update:
    path: ./clusters/production
    strategy: Setters`,
	sections: [
		{
			id: 'basic',
			title: 'Basic Information',
			description: 'Resource identification',
			defaultExpanded: true
		},
		{
			id: 'git',
			title: 'Git Configuration',
			description: 'Git repository and branch settings',
			defaultExpanded: true
		},
		{
			id: 'update',
			title: 'Update Settings',
			description: 'Image update configuration',
			defaultExpanded: true
		},
		{
			id: 'commit',
			title: 'Commit Settings',
			description: 'Git commit author and message',
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
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			section: 'basic',
			placeholder: 'image-update-automation',
			description: 'Unique name for this resource',
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
			validation: {
				pattern: '^[a-z0-9]([-a-z0-9]*[a-z0-9])?$',
				message:
					'Namespace must contain only lowercase letters, numbers, and hyphens (cannot start or end with a hyphen)'
			}
		},
		{
			name: 'sourceRefName',
			label: 'Git Repository',
			path: 'spec.sourceRef.name',
			type: 'string',
			required: true,
			section: 'git',
			placeholder: 'flux-system',
			description: 'Name of the GitRepository to update'
		},
		{
			name: 'sourceKind',
			label: 'Source Kind',
			path: 'spec.sourceRef.kind',
			type: 'select',
			section: 'git',
			default: 'GitRepository',
			options: [{ label: 'GitRepository', value: 'GitRepository' }],
			description: 'Kind of the source repository'
		},
		{
			name: 'sourceNamespace',
			label: 'Source Namespace',
			path: 'spec.sourceRef.namespace',
			type: 'string',
			section: 'git',
			placeholder: 'flux-system',
			description: 'Namespace of the source repository'
		},
		{
			name: 'branch',
			label: 'Checkout Branch',
			path: 'spec.git.checkout.ref.branch',
			type: 'string',
			required: true,
			section: 'git',
			default: 'main',
			description: 'Branch to checkout'
		},
		{
			name: 'pushBranch',
			label: 'Push Branch',
			path: 'spec.git.push.branch',
			type: 'string',
			section: 'git',
			placeholder: 'main',
			description: 'Branch to push changes to (defaults to checkout branch)'
		},
		{
			name: 'interval',
			label: 'Update Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'update',
			default: '30m',
			description: 'How often to check for image updates',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))+$',
				message: 'Duration must be in Flux format (e.g., 60s, 1m30s, 5m)'
			}
		},
		{
			name: 'updatePath',
			label: 'Update Path',
			path: 'spec.update.path',
			type: 'string',
			required: true,
			section: 'update',
			default: './',
			placeholder: './clusters/production',
			description: 'Path in repository to update'
		},
		{
			name: 'updateStrategy',
			label: 'Update Strategy',
			path: 'spec.update.strategy',
			type: 'select',
			section: 'update',
			default: 'Setters',
			options: [{ label: 'Setters', value: 'Setters' }],
			description: 'Strategy for updating images'
		},
		{
			name: 'authorName',
			label: 'Author Name',
			path: 'spec.git.commit.author.name',
			type: 'string',
			section: 'commit',
			default: 'fluxcdbot',
			description: 'Git commit author name'
		},
		{
			name: 'authorEmail',
			label: 'Author Email',
			path: 'spec.git.commit.author.email',
			type: 'string',
			section: 'commit',
			default: 'fluxcdbot@example.com',
			description: 'Git commit author email'
		},
		{
			name: 'messageTemplate',
			label: 'Commit Message Template',
			path: 'spec.git.commit.messageTemplate',
			type: 'textarea',
			section: 'commit',
			default: 'chore: update image tags',
			description: 'Template for commit messages'
		},
		{
			name: 'messageTemplateValues',
			label: 'Commit Message Values',
			path: 'spec.git.commit.messageTemplateValues',
			type: 'textarea',
			section: 'commit',
			placeholder: 'cluster: prod-1',
			description: 'Key-value pairs for message template (YAML format)'
		},
		{
			name: 'signingKeySecret',
			label: 'Signing Key Secret',
			path: 'spec.git.commit.signingKeySecretRef.name',
			type: 'string',
			section: 'commit',
			placeholder: 'git-signing-key',
			description: 'Secret containing GPG signing key for signed commits'
		},
		{
			name: 'policySelector',
			label: 'Policy Selector',
			path: 'spec.policySelector',
			type: 'textarea',
			section: 'advanced',
			placeholder: 'matchLabels:\n  app: my-app',
			description: 'Selector for ImagePolicies (YAML format)'
		},
		{
			name: 'suspend',
			label: 'Suspend',
			path: 'spec.suspend',
			type: 'boolean',
			section: 'update',
			default: false,
			description: 'Suspend automation'
		}
	]
};

export const templates: ResourceTemplate[] = [
	GIT_REPOSITORY_TEMPLATE,
	HELM_REPOSITORY_TEMPLATE,
	HELM_CHART_TEMPLATE,
	BUCKET_TEMPLATE,
	OCI_REPOSITORY_TEMPLATE,
	KUSTOMIZATION_TEMPLATE,
	HELM_RELEASE_TEMPLATE,
	ALERT_TEMPLATE,
	PROVIDER_TEMPLATE,
	RECEIVER_TEMPLATE,
	IMAGE_REPOSITORY_TEMPLATE,
	IMAGE_POLICY_TEMPLATE,
	IMAGE_UPDATE_AUTOMATION_TEMPLATE
];
