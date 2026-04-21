import { CEL_VALIDATION, DURATION_VALIDATION, type ResourceTemplate } from './types.js';

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
  path: ./
  prune: false
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
			description: 'Name of the source resource',
			referenceTypeField: 'sourceKind',
			referenceNamespaceField: 'sourceNamespace'
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
			placeholder: './',
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
			validation: DURATION_VALIDATION
		},
		{
			name: 'prune',
			label: 'Prune Resources',
			path: 'spec.prune',
			type: 'boolean',
			section: 'deployment',
			default: false,
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
					description: 'CEL expression to check if the resource is still progressing',
					validation: CEL_VALIDATION
				},
				{
					name: 'failed',
					label: 'Failed Expression',
					path: 'failed',
					type: 'textarea',
					description: 'CEL expression to check if the resource has failed',
					validation: CEL_VALIDATION
				},
				{
					name: 'current',
					label: 'Current Expression',
					path: 'current',
					type: 'textarea',
					required: true,
					description: 'CEL expression to check if the resource is healthy',
					validation: CEL_VALIDATION
				}
			],
			description:
				'CEL expressions for health assessment. Evaluation order: inProgress → failed → current',
			helpText:
				'CEL expressions evaluated in order: inProgress (progressing), failed (unhealthy), current (healthy).'
		},
		{
			name: 'timeout',
			label: 'Timeout',
			path: 'spec.timeout',
			type: 'duration',
			section: 'health',
			default: '10m',
			placeholder: '10m',
			description: 'Timeout for health checks and operations',
			validation: DURATION_VALIDATION
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
			validation: DURATION_VALIDATION
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
			description:
				'Key-value pairs for variable substitution (YAML format). Keys must be valid identifiers (letters, digits, underscores; cannot start with a digit).'
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
		}
	]
};
