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
}

export interface TemplateField {
	name: string;
	label: string;
	path: string; // JSON path or similar to update the YAML
	type: 'string' | 'number' | 'boolean' | 'select' | 'duration' | 'textarea';
	default?: string | number | boolean;
	options?: { label: string; value: string }[];
	required?: boolean;
	description?: string;
	section?: string; // Section grouping for fields
	placeholder?: string;
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
			description: 'Unique name for this GitRepository resource'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			section: 'basic',
			default: 'flux-system',
			description: 'Namespace where the resource will be created'
		},

		// Source Configuration
		{
			name: 'url',
			label: 'Repository URL',
			path: 'spec.url',
			type: 'string',
			required: true,
			section: 'source',
			placeholder: 'https://github.com/org/repo',
			description: 'Git repository URL (https://, ssh://, or git@)'
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
			section: 'source',
			default: 'main',
			placeholder: 'main',
			description: 'Branch name to track (if reference type is branch)'
		},
		{
			name: 'tag',
			label: 'Tag',
			path: 'spec.ref.tag',
			type: 'string',
			section: 'source',
			placeholder: 'v1.0.0',
			description: 'Tag name to track (if reference type is tag)'
		},
		{
			name: 'semver',
			label: 'Semver Range',
			path: 'spec.ref.semver',
			type: 'string',
			section: 'source',
			placeholder: '>=1.0.0',
			description: 'Semver range to track (if reference type is semver)'
		},
		{
			name: 'commit',
			label: 'Commit SHA',
			path: 'spec.ref.commit',
			type: 'string',
			section: 'source',
			placeholder: 'abc123...',
			description: 'Specific commit SHA to track (if reference type is commit)'
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
			description: 'How often to check for repository changes (e.g., 1m, 5m, 1h)'
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
			description: 'Timeout for Git operations'
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
			name: 'ignore',
			label: 'Ignore Paths',
			path: 'spec.ignore',
			type: 'textarea',
			section: 'advanced',
			placeholder: '# .gitignore format\n*.txt\n/temp/',
			description: 'Paths to ignore when calculating artifact checksum (.gitignore format)'
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
			description: 'Unique name for this HelmRepository resource'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			section: 'basic',
			default: 'flux-system',
			description: 'Namespace where the resource will be created'
		},

		// Repository Configuration
		{
			name: 'url',
			label: 'Repository URL',
			path: 'spec.url',
			type: 'string',
			required: true,
			section: 'source',
			placeholder: 'https://charts.bitnami.com/bitnami',
			description: 'HTTP/S or OCI Helm repository URL'
		},
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
			name: 'interval',
			label: 'Sync Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'source',
			default: '5m',
			placeholder: '5m',
			description: 'How often to check for new chart versions'
		},

		// Authentication
		{
			name: 'secretRefName',
			label: 'Secret Name',
			path: 'spec.secretRef.name',
			type: 'string',
			section: 'auth',
			placeholder: 'helm-repo-credentials',
			description: 'Secret containing authentication credentials (username/password or certFile/keyFile)'
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
			description: 'Timeout for index download operations'
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
			description: 'Unique name for this Kustomization resource'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			section: 'basic',
			default: 'flux-system',
			description: 'Namespace where the resource will be created'
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
			description: 'How often to reconcile the Kustomization'
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
			name: 'targetNamespace',
			label: 'Target Namespace',
			path: 'spec.targetNamespace',
			type: 'string',
			section: 'deployment',
			placeholder: 'default',
			description: 'Override namespace for all resources'
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
			name: 'timeout',
			label: 'Timeout',
			path: 'spec.timeout',
			type: 'duration',
			section: 'health',
			placeholder: '5m',
			description: 'Timeout for health checks and operations'
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
			description: 'Unique name for this HelmRelease resource'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			section: 'basic',
			default: 'flux-system',
			description: 'Namespace where the resource will be created'
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
			description: 'How often to reconcile the release'
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
			name: 'releaseName',
			label: 'Release Name',
			path: 'spec.releaseName',
			type: 'string',
			section: 'release',
			placeholder: 'my-app',
			description: 'Helm release name (defaults to metadata.name)'
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
			description: 'Timeout for Helm operations'
		},
		{
			name: 'serviceAccountName',
			label: 'Service Account',
			path: 'spec.serviceAccountName',
			type: 'string',
			section: 'advanced',
			placeholder: 'helm-controller',
			description: 'ServiceAccount to impersonate for Helm operations'
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
			description: 'Unique name for this HelmChart resource'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			section: 'basic',
			default: 'flux-system',
			description: 'Namespace where the resource will be created'
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
			name: 'interval',
			label: 'Sync Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'chart',
			default: '5m',
			placeholder: '5m',
			description: 'How often to check for new chart versions'
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
		}
	]
};

export const BUCKET_TEMPLATE: ResourceTemplate = {
	id: 'bucket-base',
	name: 'Bucket',
	description: 'Sources from an S3-compatible bucket',
	kind: 'Bucket',
	group: 'source.toolkit.fluxcd.io',
	version: 'v1beta2',
	category: 'sources',
	yaml: `apiVersion: source.toolkit.fluxcd.io/v1beta2
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
			description: 'Unique name for this Bucket resource'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			section: 'basic',
			default: 'flux-system',
			description: 'Namespace where the resource will be created'
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
			name: 'interval',
			label: 'Sync Interval',
			path: 'spec.interval',
			type: 'duration',
			required: true,
			section: 'bucket',
			default: '5m',
			placeholder: '5m',
			description: 'How often to check for changes'
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
			description: 'Timeout for bucket operations'
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
			description: 'Unique name for this OCIRepository resource'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			section: 'basic',
			default: 'flux-system',
			description: 'Namespace where the resource will be created'
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
			description: 'OCI repository URL (must start with oci://)'
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
			description: 'Tag to track (if reference type is tag)'
		},
		{
			name: 'semver',
			label: 'Semver Range',
			path: 'spec.ref.semver',
			type: 'string',
			section: 'source',
			placeholder: '>=1.0.0',
			description: 'Semver range to track (if reference type is semver)'
		},
		{
			name: 'digest',
			label: 'Digest',
			path: 'spec.ref.digest',
			type: 'string',
			section: 'source',
			placeholder: 'sha256:abc123...',
			description: 'Digest to track (if reference type is digest)'
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
			description: 'How often to check for changes'
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
			description: 'Timeout for OCI operations'
		},
		{
			name: 'ignore',
			label: 'Ignore Paths',
			path: 'spec.ignore',
			type: 'textarea',
			section: 'advanced',
			placeholder: '# .gitignore format\n*.md',
			description: 'Paths to ignore when calculating artifact checksum'
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
	fields: [
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			default: 'example'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			default: 'flux-system'
		},
		{
			name: 'providerName',
			label: 'Provider Name',
			path: 'spec.providerRef.name',
			type: 'string',
			required: true,
			description: 'Name of the notification Provider'
		},
		{
			name: 'eventSeverity',
			label: 'Event Severity',
			path: 'spec.eventSeverity',
			type: 'select',
			options: [
				{ label: 'Info', value: 'info' },
				{ label: 'Error', value: 'error' }
			],
			default: 'info'
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
	fields: [
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			default: 'slack'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			default: 'flux-system'
		},
		{
			name: 'type',
			label: 'Type',
			path: 'spec.type',
			type: 'select',
			options: [
				{ label: 'Slack', value: 'slack' },
				{ label: 'Discord', value: 'discord' },
				{ label: 'Microsoft Teams', value: 'msteams' },
				{ label: 'Generic Webhook', value: 'generic' },
				{ label: 'GitHub', value: 'github' }
			],
			required: true
		},
		{
			name: 'channel',
			label: 'Channel',
			path: 'spec.channel',
			type: 'string',
			description: 'Notification channel/room (for Slack, Discord, etc.)'
		},
		{
			name: 'secretName',
			label: 'Secret Name',
			path: 'spec.secretRef.name',
			type: 'string',
			required: true,
			description: 'Secret containing webhook URL or credentials'
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
	fields: [
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			default: 'example'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			default: 'flux-system'
		},
		{
			name: 'type',
			label: 'Type',
			path: 'spec.type',
			type: 'select',
			options: [
				{ label: 'GitHub', value: 'github' },
				{ label: 'GitLab', value: 'gitlab' },
				{ label: 'Bitbucket', value: 'bitbucket' },
				{ label: 'Harbor', value: 'harbor' },
				{ label: 'Generic', value: 'generic' }
			],
			required: true
		},
		{
			name: 'secretName',
			label: 'Secret Name',
			path: 'spec.secretRef.name',
			type: 'string',
			required: true,
			description: 'Secret containing webhook token'
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
	yaml: `apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  image: ghcr.io/org/app`,
	fields: [
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			default: 'example'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			default: 'flux-system'
		},
		{
			name: 'image',
			label: 'Image',
			path: 'spec.image',
			type: 'string',
			required: true,
			description: 'Container image to scan (e.g., ghcr.io/org/app)'
		},
		{
			name: 'interval',
			label: 'Interval',
			path: 'spec.interval',
			type: 'duration',
			default: '5m',
			description: 'Scan interval'
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
	fields: [
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			default: 'example'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			default: 'flux-system'
		},
		{
			name: 'imageRepositoryName',
			label: 'Image Repository',
			path: 'spec.imageRepositoryRef.name',
			type: 'string',
			required: true,
			description: 'Name of the ImageRepository to use'
		},
		{
			name: 'semverRange',
			label: 'Semver Range',
			path: 'spec.policy.semver.range',
			type: 'string',
			default: '>=1.0.0',
			description: 'Semantic version constraint'
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
	fields: [
		{
			name: 'name',
			label: 'Name',
			path: 'metadata.name',
			type: 'string',
			required: true,
			default: 'example'
		},
		{
			name: 'namespace',
			label: 'Namespace',
			path: 'metadata.namespace',
			type: 'string',
			required: true,
			default: 'flux-system'
		},
		{
			name: 'sourceRefName',
			label: 'Git Repository',
			path: 'spec.sourceRef.name',
			type: 'string',
			required: true,
			description: 'Name of the GitRepository'
		},
		{
			name: 'branch',
			label: 'Branch',
			path: 'spec.git.checkout.ref.branch',
			type: 'string',
			default: 'main',
			description: 'Git branch to update'
		},
		{
			name: 'updatePath',
			label: 'Update Path',
			path: 'spec.update.path',
			type: 'string',
			default: './clusters/production',
			description: 'Path to update in the repository'
		},
		{
			name: 'interval',
			label: 'Interval',
			path: 'spec.interval',
			type: 'duration',
			default: '30m'
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
