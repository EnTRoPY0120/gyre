export interface ResourceTemplate {
	id: string;
	name: string;
	description: string;
	kind: string;
	group: string;
	version: string;
	yaml: string;
	fields: TemplateField[];
}

export interface TemplateField {
	name: string;
	label: string;
	path: string; // JSON path or similar to update the YAML
	type: 'string' | 'number' | 'boolean' | 'select' | 'duration';
	default?: string | number | boolean;
	options?: { label: string; value: string }[];
	required?: boolean;
	description?: string;
}

export const GIT_REPOSITORY_TEMPLATE: ResourceTemplate = {
	id: 'git-repository-base',
	name: 'Git Repository',
	description: 'Sources from a Git repository',
	kind: 'GitRepository',
	group: 'source.toolkit.fluxcd.io',
	version: 'v1',
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
			name: 'url',
			label: 'Repository URL',
			path: 'spec.url',
			type: 'string',
			required: true,
			description: 'The URL of the Git repository'
		},
		{
			name: 'branch',
			label: 'Branch',
			path: 'spec.ref.branch',
			type: 'string',
			default: 'main',
			description: 'The branch to track'
		},
		{
			name: 'interval',
			label: 'Interval',
			path: 'spec.interval',
			type: 'duration',
			default: '1m',
			description: 'The interval at which to check for changes'
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
	yaml: `apiVersion: source.toolkit.fluxcd.io/v1
kind: HelmRepository
metadata:
  name: example
  namespace: flux-system
spec:
  interval: 5m
  url: https://charts.bitnami.com/bitnami`,
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
			name: 'url',
			label: 'URL',
			path: 'spec.url',
			type: 'string',
			required: true,
			description: 'The URL of the Helm repository'
		},
		{
			name: 'interval',
			label: 'Interval',
			path: 'spec.interval',
			type: 'duration',
			default: '5m'
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
			name: 'path',
			label: 'Path',
			path: 'spec.path',
			type: 'string',
			default: './deploy',
			description: 'Path within the source repository'
		},
		{
			name: 'sourceName',
			label: 'Source Name',
			path: 'spec.sourceRef.name',
			type: 'string',
			required: true,
			description: 'The name of the source resource'
		},
		{
			name: 'sourceKind',
			label: 'Source Kind',
			path: 'spec.sourceRef.kind',
			type: 'select',
			options: [
				{ label: 'Git Repository', value: 'GitRepository' },
				{ label: 'Bucket', value: 'Bucket' },
				{ label: 'OCI Repository', value: 'OCIRepository' }
			],
			default: 'GitRepository'
		},
		{
			name: 'prune',
			label: 'Prune',
			path: 'spec.prune',
			type: 'boolean',
			default: true
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
			name: 'chartName',
			label: 'Chart Name',
			path: 'spec.chart.spec.chart',
			type: 'string',
			required: true
		},
		{
			name: 'chartVersion',
			label: 'Chart Version',
			path: 'spec.chart.spec.version',
			type: 'string',
			default: '>=1.0.0'
		},
		{
			name: 'sourceName',
			label: 'Source Name',
			path: 'spec.chart.spec.sourceRef.name',
			type: 'string',
			required: true
		}
	]
};

export const templates: ResourceTemplate[] = [
	GIT_REPOSITORY_TEMPLATE,
	HELM_REPOSITORY_TEMPLATE,
	KUSTOMIZATION_TEMPLATE,
	HELM_RELEASE_TEMPLATE
];
