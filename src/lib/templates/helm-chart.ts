import type { ResourceTemplate } from './types.js';

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
			description: 'Name of the source resource',
			referenceTypeField: 'sourceKind'
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
				pattern: '^([0-9]+(\\.[0-9]+)?(s|m|h))*$',
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
