import type { ResourceTemplate } from './types.js';

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
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))*$',
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
			default: '10m',
			placeholder: '60s',
			description: 'Timeout for Git operations',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))*$',
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
			path: 'spec.sparseCheckout.paths',
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
					placeholder: 'other-repo',
					referenceType: 'GitRepository'
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
