import type { ResourceTemplate } from './types.js';

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
			id: 'resourceLimits',
			title: 'Resource Limits',
			description: 'CPU and memory constraints for deployed workloads',
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
			description: 'Name of the source resource',
			referenceTypeField: 'chartSourceKind',
			referenceNamespaceField: 'chartSourceNamespace'
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
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))*$',
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
			description:
				"Helm values to override (YAML format). Values are passed directly to the chart — ensure they match the chart's values schema."
		},
		{
			name: 'valuesFiles',
			label: 'Values Files',
			path: 'spec.chart.spec.valuesFiles',
			type: 'array',
			section: 'release',
			arrayItemType: 'string',
			placeholder: 'values.yaml',
			description: 'List of values files to use from the chart'
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
				{
					name: 'name',
					label: 'Name',
					path: 'name',
					type: 'string'
				},
				{
					name: 'namespace',
					label: 'Namespace',
					path: 'namespace',
					type: 'string',
					placeholder: 'flux-system',
					description:
						'Namespace of the referenced resource. Leave blank to use the HelmRelease namespace.'
				},
				{ name: 'valuesKey', label: 'Values Key', path: 'valuesKey', type: 'string' },
				{ name: 'targetPath', label: 'Target Path', path: 'targetPath', type: 'string' },
				{ name: 'optional', label: 'Optional', path: 'optional', type: 'boolean' }
			],
			description: 'References to ConfigMaps or Secrets containing Helm values.',
			helpText:
				"Security: valuesFrom can reference resources from any namespace if the controller's RBAC permits it. Prefer referencing Secrets and ConfigMaps in the same namespace as the HelmRelease to limit exposure."
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
			description:
				'Common labels applied to all managed resources (YAML format). Keys max 63 chars, values max 63 chars. Valid chars: alphanumeric, hyphens, underscores, dots.'
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
		{
			name: 'resourceLimitsCpu',
			label: 'CPU Limit',
			path: 'spec.values.resources.limits.cpu',
			type: 'string',
			section: 'resourceLimits',
			placeholder: '500m',
			description:
				'Maximum CPU for deployed pods (e.g. 500m, 1). Sets spec.values.resources.limits.cpu.',
			helpText:
				'Most Helm charts expose resources.limits.cpu in their values. If your chart uses a different key, edit spec.values directly.'
		},
		{
			name: 'resourceLimitsMemory',
			label: 'Memory Limit',
			path: 'spec.values.resources.limits.memory',
			type: 'string',
			section: 'resourceLimits',
			placeholder: '128Mi',
			description:
				'Maximum memory for deployed pods (e.g. 128Mi, 1Gi). Sets spec.values.resources.limits.memory.'
		},
		{
			name: 'resourceRequestsCpu',
			label: 'CPU Request',
			path: 'spec.values.resources.requests.cpu',
			type: 'string',
			section: 'resourceLimits',
			placeholder: '100m',
			description:
				'Requested CPU for scheduling (e.g. 100m). Sets spec.values.resources.requests.cpu.'
		},
		{
			name: 'resourceRequestsMemory',
			label: 'Memory Request',
			path: 'spec.values.resources.requests.memory',
			type: 'string',
			section: 'resourceLimits',
			placeholder: '64Mi',
			description:
				'Requested memory for scheduling (e.g. 64Mi). Sets spec.values.resources.requests.memory.'
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
			default: '10m',
			placeholder: '5m',
			description: 'Timeout for Helm operations',
			validation: {
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))*$',
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
			description:
				'Post-renderers to apply to rendered manifests. Only trusted YAML should be used here as patches are applied with cluster write permissions.'
		}
	]
};
