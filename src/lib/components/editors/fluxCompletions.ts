import type * as Monaco from 'monaco-editor';

let featuresRegistered = false;

interface FieldCompletion {
	label: string;
	insertText: string;
	detail: string;
	documentation: string;
}

// Keyed by `Kind::dot.separated.parent.path`
type Schema = Record<string, Record<string, FieldCompletion[]>>;

const COMMON_INTERVAL_VALUES = ['30s', '1m', '5m', '10m', '30m', '1h', '6h', '12h', '24h'];
const COMMON_TIMEOUT_VALUES = ['30s', '1m', '2m', '5m', '10m', '30m'];
const COMMON_PROVIDER_VALUES = ['generic', 'aws', 'azure', 'gcp'];
const BOOLEAN_VALUES = ['true', 'false'];

// Fields whose values have a fixed set of suggestions, keyed by field name
const VALUE_COMPLETIONS: Record<string, string[]> = {
	interval: COMMON_INTERVAL_VALUES,
	timeout: COMMON_TIMEOUT_VALUES,
	suspend: BOOLEAN_VALUES,
	prune: BOOLEAN_VALUES,
	force: BOOLEAN_VALUES,
	wait: BOOLEAN_VALUES,
	insecure: BOOLEAN_VALUES,
	recurseSubmodules: BOOLEAN_VALUES,
	passCredentials: BOOLEAN_VALUES,
	originalEditable: BOOLEAN_VALUES,
	renderSideBySide: BOOLEAN_VALUES,
	provider: COMMON_PROVIDER_VALUES,
	severity: ['info', 'error'],
	reconcileStrategy: ['ChartVersion', 'Revision'],
	type: ['default', 'oci'] // overridden per context where needed
};

// Path-specific value overrides keyed by "Kind.parentPath.fieldName".
// Checked before VALUE_COMPLETIONS so overloaded fields (provider, type)
// return context-correct suggestions.
const VALUE_COMPLETIONS_BY_PATH: Record<string, string[]> = {
	// Notification provider types
	'Provider.spec.type': [
		'slack',
		'discord',
		'msteams',
		'googlechat',
		'telegram',
		'matrix',
		'lark',
		'rocket',
		'webex',
		'sentry',
		'pagerduty',
		'opsgenie',
		'datadog',
		'grafana',
		'github',
		'gitlab',
		'gitea',
		'bitbucketserver',
		'bitbucket',
		'azuredevops',
		'azureeventhub',
		'githubdispatch',
		'alertmanager',
		'generic',
		'generic-hmac'
	],
	// Webhook receiver platforms
	'Receiver.spec.type': [
		'generic',
		'github',
		'gitlab',
		'bitbucket',
		'harbor',
		'quay',
		'gcr',
		'nexus',
		'acr'
	],
	// Kustomization secret decryption — only sops is currently supported
	'Kustomization.spec.decryption.provider': ['sops']
};

// Hover documentation for common FluxCD fields
const FIELD_HOVER_DOCS: Record<string, string> = {
	interval:
		'The interval at which to reconcile or fetch the resource.\n\n**Format:** `<number><unit>`\n\n**Examples:** `30s`, `1m`, `5m`, `1h`',
	url: 'The URL of the source.\n\n**Examples:**\n- `https://github.com/org/repo` (Git/Helm)\n- `oci://registry.io/repo` (OCI)\n- `https://charts.example.com` (Helm repo)',
	timeout:
		'The maximum time to wait for reconciliation operations to complete.\n\n**Format:** `<number><unit>` (e.g., `60s`, `5m`)',
	suspend:
		'When `true`, the controller stops reconciling this resource. Existing resources are not deleted.',
	secretRef: 'Reference to a Kubernetes Secret in the same namespace containing credentials.',
	sourceRef:
		'Reference to the source artifact (GitRepository, HelmRepository, OCIRepository, etc.)',
	prune:
		'When `true`, enables garbage collection — resources removed from the source are deleted from the cluster.',
	force:
		'When `true`, instructs the controller to recreate resources on apply failures using a delete + create strategy.',
	path: 'Path within the source repository to the directory containing the kustomization.yaml or raw manifests.',
	targetNamespace: 'Overrides the namespace for all managed Kubernetes resources.',
	dependsOn:
		'A list of Flux resources this resource depends on. The controller waits for them to be `Ready` before reconciling.',
	branch: 'The Git branch to checkout.',
	tag: 'The Git tag to checkout.',
	semver:
		'A SemVer range constraint used to select a Git tag or OCI image tag.\n\n**Examples:** `>=1.0.0`, `~1.2.3`, `1.x`',
	commit: 'The full SHA of the Git commit to checkout.',
	chart: 'The name or path of the Helm chart.',
	version:
		'The Helm chart version semver expression.\n\n**Examples:** `1.2.3`, `>=1.0.0 <2.0.0`, `*`',
	values: 'Inline values passed to the Helm chart, in YAML object form.',
	valuesFrom: 'References to ConfigMaps or Secrets whose data is merged into chart values.',
	releaseName: 'Overrides the generated Helm release name.',
	maxHistory:
		'The maximum number of release revisions saved in the Helm release history. Defaults to 5.',
	serviceAccountName: 'The name of a Kubernetes ServiceAccount to impersonate when reconciling.',
	provider: 'The platform-specific auth or storage provider.',
	insecure: 'Allow connections to non-TLS HTTP endpoints.',
	recurseSubmodules: 'Recursively clone Git submodules when fetching the repository.',
	ignore: 'Gitignore-style patterns for excluding files from the source artifact.',
	bucketName: 'The name of the S3-compatible storage bucket.',
	endpoint: 'The S3-compatible endpoint URL.',
	region: 'The cloud storage region where the bucket resides.',
	passCredentials:
		'Pass the SecretRef credentials to all hosts, not just the managed repository host.',
	severity: 'The minimum event severity to alert on. One of: `info`, `error`',
	reconcileStrategy:
		'What triggers creation of a new Helm chart artifact.\n- `ChartVersion` — a new chart version\n- `Revision` — any new source revision'
};

const SCHEMA: Schema = {
	// ─── GitRepository ───────────────────────────────────────────────────────
	GitRepository: {
		'': [
			{
				label: 'apiVersion',
				insertText: 'apiVersion: source.toolkit.fluxcd.io/v1',
				detail: 'API version',
				documentation: 'The API version for this FluxCD resource.'
			},
			{
				label: 'kind',
				insertText: 'kind: GitRepository',
				detail: 'Resource kind',
				documentation: 'Declares this resource as a FluxCD GitRepository.'
			},
			{
				label: 'metadata',
				insertText: 'metadata:\n  name: \n  namespace: flux-system',
				detail: 'Resource metadata',
				documentation: 'Standard Kubernetes metadata (name, namespace, labels, etc.)'
			},
			{
				label: 'spec',
				insertText: 'spec:',
				detail: 'Resource specification',
				documentation: 'The desired state of the GitRepository.'
			}
		],
		metadata: [
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Resource name',
				documentation: 'The unique name of the resource within the namespace.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Namespace',
				documentation: 'The Kubernetes namespace to create this resource in.'
			},
			{
				label: 'labels',
				insertText: 'labels:\n  ',
				detail: 'Labels',
				documentation: 'Key-value pairs attached to this resource for identification.'
			},
			{
				label: 'annotations',
				insertText: 'annotations:\n  ',
				detail: 'Annotations',
				documentation: 'Non-identifying key-value metadata attached to this resource.'
			}
		],
		spec: [
			{
				label: 'interval',
				insertText: 'interval: 1m',
				detail: 'Reconcile interval',
				documentation: 'How often to check for source updates.'
			},
			{
				label: 'url',
				insertText: 'url: https://github.com/org/repo',
				detail: 'Repository URL',
				documentation:
					'The URL of the Git repository. Supports `https://`, `ssh://`, and `git@` formats.'
			},
			{
				label: 'ref',
				insertText: 'ref:\n  branch: main',
				detail: 'Git reference',
				documentation: 'The Git reference (branch, tag, commit, or semver range) to checkout.'
			},
			{
				label: 'secretRef',
				insertText: 'secretRef:\n  name: ',
				detail: 'Auth secret',
				documentation:
					'Reference to a Secret containing authentication credentials (SSH key, username/password, or token).'
			},
			{
				label: 'timeout',
				insertText: 'timeout: 60s',
				detail: 'Operation timeout',
				documentation: 'The timeout for remote Git operations (clone, fetch, etc.)'
			},
			{
				label: 'suspend',
				insertText: 'suspend: false',
				detail: 'Suspend reconciliation',
				documentation:
					'When `true`, the controller stops reconciling this resource without deleting existing objects.'
			},
			{
				label: 'recurseSubmodules',
				insertText: 'recurseSubmodules: false',
				detail: 'Recurse submodules',
				documentation: 'Recursively clone Git submodules when fetching.'
			},
			{
				label: 'ignore',
				insertText: 'ignore: |',
				detail: 'Ignore patterns',
				documentation:
					'Overrides the set of excluded patterns in `.sourceignore` format. Allows excluding files from the artifact.'
			},
			{
				label: 'include',
				insertText: 'include:\n  - fromPath: \n    toPath: ',
				detail: 'Include other repositories',
				documentation: 'Embeds the contents of other GitRepository artifacts into this one.'
			},
			{
				label: 'verification',
				insertText: 'verification:\n  provider: openpgp\n  secretRef:\n    name: ',
				detail: 'Commit verification',
				documentation: 'Verifies the commit signature using GPG keys from a Secret.'
			},
			{
				label: 'proxySecretRef',
				insertText: 'proxySecretRef:\n  name: ',
				detail: 'Proxy secret',
				documentation: 'Reference to a Secret containing a proxy address and optional credentials.'
			}
		],
		'spec.ref': [
			{
				label: 'branch',
				insertText: 'branch: main',
				detail: 'Branch name',
				documentation: 'The Git branch to checkout.'
			},
			{
				label: 'tag',
				insertText: 'tag: ',
				detail: 'Tag name',
				documentation: 'The Git tag to checkout.'
			},
			{
				label: 'semver',
				insertText: 'semver: ">=1.0.0"',
				detail: 'SemVer range',
				documentation: 'A SemVer range to select a matching Git tag.'
			},
			{
				label: 'name',
				insertText: 'name: refs/heads/main',
				detail: 'Reference name',
				documentation: 'The full Git reference name (e.g., `refs/heads/main`, `refs/pull/1/head`).'
			},
			{
				label: 'commit',
				insertText: 'commit: ',
				detail: 'Commit SHA',
				documentation: 'The full SHA-1 hash of a specific Git commit to checkout.'
			}
		],
		'spec.secretRef': [
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Secret name',
				documentation: 'The name of the Secret in the same namespace.'
			}
		],
		'spec.verification': [
			{
				label: 'provider',
				insertText: 'provider: openpgp',
				detail: 'Verification provider',
				documentation: 'The verification provider. Currently supported: `openpgp`.'
			},
			{
				label: 'secretRef',
				insertText: 'secretRef:\n  name: ',
				detail: 'GPG keys secret',
				documentation: 'Reference to a Secret containing trusted GPG public keys.'
			}
		]
	},

	// ─── Kustomization ───────────────────────────────────────────────────────
	Kustomization: {
		'': [
			{
				label: 'apiVersion',
				insertText: 'apiVersion: kustomize.toolkit.fluxcd.io/v1',
				detail: 'API version',
				documentation: 'The API version for this FluxCD resource.'
			},
			{
				label: 'kind',
				insertText: 'kind: Kustomization',
				detail: 'Resource kind',
				documentation: 'Declares this resource as a FluxCD Kustomization.'
			},
			{
				label: 'metadata',
				insertText: 'metadata:\n  name: \n  namespace: flux-system',
				detail: 'Resource metadata',
				documentation: 'Standard Kubernetes metadata.'
			},
			{
				label: 'spec',
				insertText: 'spec:',
				detail: 'Resource specification',
				documentation: 'The desired state of the Kustomization.'
			}
		],
		metadata: [
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Resource name',
				documentation: 'The unique name of the resource within the namespace.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Namespace',
				documentation: 'The Kubernetes namespace to create this resource in.'
			},
			{
				label: 'labels',
				insertText: 'labels:\n  ',
				detail: 'Labels',
				documentation: 'Key-value labels for selection and identification.'
			},
			{
				label: 'annotations',
				insertText: 'annotations:\n  ',
				detail: 'Annotations',
				documentation: 'Arbitrary metadata attached to this resource.'
			}
		],
		spec: [
			{
				label: 'interval',
				insertText: 'interval: 1m',
				detail: 'Reconcile interval',
				documentation: 'How often to reconcile the Kustomization.'
			},
			{
				label: 'path',
				insertText: 'path: ./',
				detail: 'Path in source',
				documentation:
					'Path within the source to the directory containing `kustomization.yaml` or raw Kubernetes manifests.'
			},
			{
				label: 'sourceRef',
				insertText: 'sourceRef:\n  kind: GitRepository\n  name: ',
				detail: 'Source reference',
				documentation: 'Reference to the source artifact (GitRepository, OCIRepository, or Bucket).'
			},
			{
				label: 'prune',
				insertText: 'prune: true',
				detail: 'Enable pruning',
				documentation:
					'When `true`, resources no longer tracked by the source are deleted from the cluster.'
			},
			{
				label: 'suspend',
				insertText: 'suspend: false',
				detail: 'Suspend reconciliation',
				documentation: 'When `true`, stops reconciliation without deleting existing resources.'
			},
			{
				label: 'timeout',
				insertText: 'timeout: 5m',
				detail: 'Apply timeout',
				documentation: 'Maximum time allowed for apply and health-check operations.'
			},
			{
				label: 'targetNamespace',
				insertText: 'targetNamespace: ',
				detail: 'Target namespace',
				documentation: 'Overrides the namespace for all resources managed by this Kustomization.'
			},
			{
				label: 'force',
				insertText: 'force: false',
				detail: 'Force apply',
				documentation:
					'When `true`, the controller recreates resources via delete+create when apply fails.'
			},
			{
				label: 'wait',
				insertText: 'wait: true',
				detail: 'Wait for resources',
				documentation:
					'When `true`, waits for all managed resources to become ready before marking the Kustomization as ready.'
			},
			{
				label: 'decryption',
				insertText: 'decryption:\n  provider: sops',
				detail: 'Secret decryption',
				documentation: 'Configures secret decryption (currently only `sops` is supported).'
			},
			{
				label: 'dependsOn',
				insertText: 'dependsOn:\n  - name: ',
				detail: 'Dependencies',
				documentation:
					'List of Flux resources this Kustomization depends on. The controller waits for them to be `Ready`.'
			},
			{
				label: 'patches',
				insertText: 'patches:\n  - patch: |\n      ',
				detail: 'Kustomize patches',
				documentation: 'Strategic merge and JSON 6902 patches applied to the resources.'
			},
			{
				label: 'postBuild',
				insertText: 'postBuild:\n  substitute: {}',
				detail: 'Post-build substitution',
				documentation:
					'Performs variable substitution in the rendered manifests using `${}` placeholders.'
			},
			{
				label: 'validation',
				insertText: 'validation: client',
				detail: 'Validation strategy',
				documentation: 'Validate manifests against the Kubernetes API. One of: `client`, `server`.'
			},
			{
				label: 'serviceAccountName',
				insertText: 'serviceAccountName: ',
				detail: 'Service account',
				documentation: 'Impersonate this ServiceAccount when applying resources.'
			},
			{
				label: 'commonMetadata',
				insertText: 'commonMetadata:\n  labels: {}',
				detail: 'Common metadata',
				documentation:
					'Labels and annotations to merge into all resources managed by this Kustomization.'
			}
		],
		'spec.sourceRef': [
			{
				label: 'kind',
				insertText: 'kind: GitRepository',
				detail: 'Source kind',
				documentation:
					'The kind of source object. One of: `GitRepository`, `OCIRepository`, `Bucket`.'
			},
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Source name',
				documentation: 'The name of the source object in the same (or specified) namespace.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Source namespace',
				documentation:
					'The namespace of the source object. Defaults to the Kustomization namespace.'
			}
		],
		'spec.decryption': [
			{
				label: 'provider',
				insertText: 'provider: sops',
				detail: 'Decryption provider',
				documentation: 'The decryption engine to use. Currently only `sops` is supported.'
			},
			{
				label: 'secretRef',
				insertText: 'secretRef:\n  name: ',
				detail: 'Decryption key secret',
				documentation: 'Reference to a Secret containing the private key(s) for decryption.'
			}
		]
	},

	// ─── HelmRelease ─────────────────────────────────────────────────────────
	HelmRelease: {
		'': [
			{
				label: 'apiVersion',
				insertText: 'apiVersion: helm.toolkit.fluxcd.io/v2',
				detail: 'API version',
				documentation: 'The API version for this FluxCD resource.'
			},
			{
				label: 'kind',
				insertText: 'kind: HelmRelease',
				detail: 'Resource kind',
				documentation: 'Declares this resource as a FluxCD HelmRelease.'
			},
			{
				label: 'metadata',
				insertText: 'metadata:\n  name: \n  namespace: flux-system',
				detail: 'Resource metadata',
				documentation: 'Standard Kubernetes metadata.'
			},
			{
				label: 'spec',
				insertText: 'spec:',
				detail: 'Resource specification',
				documentation: 'The desired state of the HelmRelease.'
			}
		],
		metadata: [
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Resource name',
				documentation: 'The unique name of the HelmRelease.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Namespace',
				documentation: 'The Kubernetes namespace to create this resource in.'
			},
			{
				label: 'labels',
				insertText: 'labels:\n  ',
				detail: 'Labels',
				documentation: 'Key-value labels for selection and identification.'
			},
			{
				label: 'annotations',
				insertText: 'annotations:\n  ',
				detail: 'Annotations',
				documentation: 'Arbitrary metadata attached to this resource.'
			}
		],
		spec: [
			{
				label: 'interval',
				insertText: 'interval: 1h',
				detail: 'Reconcile interval',
				documentation: 'How often to reconcile the HelmRelease.'
			},
			{
				label: 'chart',
				insertText:
					'chart:\n  spec:\n    chart: \n    sourceRef:\n      kind: HelmRepository\n      name: ',
				detail: 'Chart reference',
				documentation: 'Defines the Helm chart to install, including its source and version.'
			},
			{
				label: 'suspend',
				insertText: 'suspend: false',
				detail: 'Suspend reconciliation',
				documentation: 'When `true`, stops reconciliation without deleting existing resources.'
			},
			{
				label: 'timeout',
				insertText: 'timeout: 5m',
				detail: 'Operation timeout',
				documentation:
					'Maximum time allowed for any single Kubernetes operation during reconciliation.'
			},
			{
				label: 'releaseName',
				insertText: 'releaseName: ',
				detail: 'Release name',
				documentation:
					'Overrides the automatically generated Helm release name. Defaults to the HelmRelease name.'
			},
			{
				label: 'targetNamespace',
				insertText: 'targetNamespace: ',
				detail: 'Target namespace',
				documentation: 'Overrides the namespace in which the Helm release is installed.'
			},
			{
				label: 'values',
				insertText: 'values:\n  ',
				detail: 'Chart values',
				documentation: 'Inline Helm values merged on top of the chart defaults.'
			},
			{
				label: 'valuesFrom',
				insertText: 'valuesFrom:\n  - kind: ConfigMap\n    name: ',
				detail: 'Values from ConfigMap/Secret',
				documentation: 'References to ConfigMaps or Secrets whose data is merged into chart values.'
			},
			{
				label: 'install',
				insertText: 'install:\n  remediation:\n    retries: 3',
				detail: 'Install configuration',
				documentation: 'Configuration for the initial Helm install action.'
			},
			{
				label: 'upgrade',
				insertText: 'upgrade:\n  remediation:\n    retries: 3',
				detail: 'Upgrade configuration',
				documentation: 'Configuration for Helm upgrade actions.'
			},
			{
				label: 'rollback',
				insertText: 'rollback:\n  timeout: 5m',
				detail: 'Rollback configuration',
				documentation: 'Configuration for Helm rollback actions.'
			},
			{
				label: 'dependsOn',
				insertText: 'dependsOn:\n  - name: ',
				detail: 'Dependencies',
				documentation:
					'List of Flux resources this HelmRelease depends on. The controller waits for them to be `Ready`.'
			},
			{
				label: 'serviceAccountName',
				insertText: 'serviceAccountName: ',
				detail: 'Service account',
				documentation: 'Impersonate this ServiceAccount when reconciling the Helm release.'
			},
			{
				label: 'maxHistory',
				insertText: 'maxHistory: 5',
				detail: 'Helm history size',
				documentation: 'Maximum number of release revisions saved in the Helm release history.'
			},
			{
				label: 'storageNamespace',
				insertText: 'storageNamespace: ',
				detail: 'Storage namespace',
				documentation: 'The namespace used to store the Helm release state Secret.'
			}
		],
		'spec.chart.spec': [
			{
				label: 'chart',
				insertText: 'chart: ',
				detail: 'Chart name',
				documentation:
					'The name of the Helm chart, or a path relative to the source root for Git/Bucket sources.'
			},
			{
				label: 'version',
				insertText: 'version: "*"',
				detail: 'Chart version',
				documentation:
					'A SemVer expression to select the chart version. Defaults to the latest version.'
			},
			{
				label: 'sourceRef',
				insertText: 'sourceRef:\n  kind: HelmRepository\n  name: ',
				detail: 'Source reference',
				documentation: 'Reference to the source containing the Helm chart.'
			},
			{
				label: 'interval',
				insertText: 'interval: 1h',
				detail: 'Fetch interval',
				documentation: 'How often to check the source for new chart versions.'
			},
			{
				label: 'reconcileStrategy',
				insertText: 'reconcileStrategy: ChartVersion',
				detail: 'Reconcile strategy',
				documentation:
					'What triggers creation of a new chart artifact.\n- `ChartVersion` — a new chart version\n- `Revision` — any new source revision'
			},
			{
				label: 'valuesFiles',
				insertText: 'valuesFiles:\n  - values.yaml',
				detail: 'Values files',
				documentation: 'Overrides the default values files used by the chart.'
			}
		],
		'spec.chart.spec.sourceRef': [
			{
				label: 'kind',
				insertText: 'kind: HelmRepository',
				detail: 'Source kind',
				documentation:
					'The kind of the source. One of: `HelmRepository`, `GitRepository`, `Bucket`.'
			},
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Source name',
				documentation: 'The name of the source object.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Source namespace',
				documentation: 'The namespace of the source object. Defaults to the HelmRelease namespace.'
			}
		]
	},

	// ─── HelmRepository ──────────────────────────────────────────────────────
	HelmRepository: {
		'': [
			{
				label: 'apiVersion',
				insertText: 'apiVersion: source.toolkit.fluxcd.io/v1',
				detail: 'API version',
				documentation: 'The API version for this FluxCD resource.'
			},
			{
				label: 'kind',
				insertText: 'kind: HelmRepository',
				detail: 'Resource kind',
				documentation: 'Declares this resource as a FluxCD HelmRepository.'
			},
			{
				label: 'metadata',
				insertText: 'metadata:\n  name: \n  namespace: flux-system',
				detail: 'Resource metadata',
				documentation: 'Standard Kubernetes metadata.'
			},
			{
				label: 'spec',
				insertText: 'spec:',
				detail: 'Resource specification',
				documentation: 'The desired state of the HelmRepository.'
			}
		],
		metadata: [
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Resource name',
				documentation: 'The unique name of the HelmRepository.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Namespace',
				documentation: 'The Kubernetes namespace to create this resource in.'
			},
			{
				label: 'labels',
				insertText: 'labels:\n  ',
				detail: 'Labels',
				documentation: 'Key-value labels for selection.'
			},
			{
				label: 'annotations',
				insertText: 'annotations:\n  ',
				detail: 'Annotations',
				documentation: 'Arbitrary metadata.'
			}
		],
		spec: [
			{
				label: 'interval',
				insertText: 'interval: 1h',
				detail: 'Fetch interval',
				documentation: 'How often to fetch the Helm repository index.'
			},
			{
				label: 'url',
				insertText: 'url: https://',
				detail: 'Repository URL',
				documentation: 'The URL of the Helm chart repository. For OCI repositories use `oci://`.'
			},
			{
				label: 'secretRef',
				insertText: 'secretRef:\n  name: ',
				detail: 'Auth secret',
				documentation: 'Reference to a Secret containing authentication credentials.'
			},
			{
				label: 'type',
				insertText: 'type: default',
				detail: 'Repository type',
				documentation:
					'The type of the Helm repository. `default` for index-based repos, `oci` for OCI registries.'
			},
			{
				label: 'timeout',
				insertText: 'timeout: 60s',
				detail: 'Operation timeout',
				documentation: 'The timeout for fetching the repository index.'
			},
			{
				label: 'suspend',
				insertText: 'suspend: false',
				detail: 'Suspend reconciliation',
				documentation: 'When `true`, stops reconciliation.'
			},
			{
				label: 'provider',
				insertText: 'provider: generic',
				detail: 'Auth provider',
				documentation:
					'The cloud provider for OCI authentication. One of: `generic`, `aws`, `azure`, `gcp`.'
			},
			{
				label: 'passCredentials',
				insertText: 'passCredentials: false',
				detail: 'Pass credentials',
				documentation:
					'When `true`, passes the SecretRef credentials to all hosts encountered during chart retrieval.'
			},
			{
				label: 'certSecretRef',
				insertText: 'certSecretRef:\n  name: ',
				detail: 'TLS cert secret',
				documentation: 'Reference to a Secret containing TLS certificate data.'
			}
		]
	},

	// ─── OCIRepository ───────────────────────────────────────────────────────
	OCIRepository: {
		'': [
			{
				label: 'apiVersion',
				insertText: 'apiVersion: source.toolkit.fluxcd.io/v1beta2',
				detail: 'API version',
				documentation: 'The API version for this FluxCD resource.'
			},
			{
				label: 'kind',
				insertText: 'kind: OCIRepository',
				detail: 'Resource kind',
				documentation: 'Declares this resource as a FluxCD OCIRepository.'
			},
			{
				label: 'metadata',
				insertText: 'metadata:\n  name: \n  namespace: flux-system',
				detail: 'Resource metadata',
				documentation: 'Standard Kubernetes metadata.'
			},
			{
				label: 'spec',
				insertText: 'spec:',
				detail: 'Resource specification',
				documentation: 'The desired state of the OCIRepository.'
			}
		],
		metadata: [
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Resource name',
				documentation: 'The unique name of the OCIRepository.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Namespace',
				documentation: 'The Kubernetes namespace to create this resource in.'
			},
			{
				label: 'labels',
				insertText: 'labels:\n  ',
				detail: 'Labels',
				documentation: 'Key-value labels.'
			},
			{
				label: 'annotations',
				insertText: 'annotations:\n  ',
				detail: 'Annotations',
				documentation: 'Arbitrary metadata.'
			}
		],
		spec: [
			{
				label: 'interval',
				insertText: 'interval: 1m',
				detail: 'Fetch interval',
				documentation: 'How often to check the OCI registry for new artifacts.'
			},
			{
				label: 'url',
				insertText: 'url: oci://',
				detail: 'OCI URL',
				documentation:
					'The URL of the OCI artifact repository, in the form `oci://<host>/<org>/<repo>`.'
			},
			{
				label: 'ref',
				insertText: 'ref:\n  tag: latest',
				detail: 'OCI reference',
				documentation: 'The OCI image reference to fetch (tag, semver, or digest).'
			},
			{
				label: 'secretRef',
				insertText: 'secretRef:\n  name: ',
				detail: 'Auth secret',
				documentation: 'Reference to a Secret containing registry login credentials.'
			},
			{
				label: 'serviceAccountName',
				insertText: 'serviceAccountName: ',
				detail: 'Service account',
				documentation:
					'ServiceAccount used to pull from the registry using IRSA / Workload Identity.'
			},
			{
				label: 'timeout',
				insertText: 'timeout: 60s',
				detail: 'Operation timeout',
				documentation: 'The timeout for remote OCI operations.'
			},
			{
				label: 'suspend',
				insertText: 'suspend: false',
				detail: 'Suspend reconciliation',
				documentation: 'When `true`, stops reconciliation.'
			},
			{
				label: 'provider',
				insertText: 'provider: generic',
				detail: 'Auth provider',
				documentation:
					'Cloud provider for registry authentication. One of: `generic`, `aws`, `azure`, `gcp`.'
			},
			{
				label: 'insecure',
				insertText: 'insecure: false',
				detail: 'Allow insecure',
				documentation: 'When `true`, allows connecting to a non-TLS HTTP registry.'
			},
			{
				label: 'certSecretRef',
				insertText: 'certSecretRef:\n  name: ',
				detail: 'TLS cert secret',
				documentation: 'Reference to a Secret containing TLS certificate data for the registry.'
			},
			{
				label: 'verify',
				insertText: 'verify:\n  provider: cosign',
				detail: 'Signature verification',
				documentation: 'Verifies the OCI artifact signature using Cosign.'
			}
		],
		'spec.ref': [
			{
				label: 'tag',
				insertText: 'tag: latest',
				detail: 'Image tag',
				documentation: 'The OCI image tag to pull.'
			},
			{
				label: 'semver',
				insertText: 'semver: ">=1.0.0"',
				detail: 'SemVer range',
				documentation: 'A SemVer range constraint to select a matching image tag.'
			},
			{
				label: 'digest',
				insertText: 'digest: sha256:',
				detail: 'Image digest',
				documentation: 'The full SHA-256 digest of the OCI artifact to pin to a specific version.'
			}
		]
	},

	// ─── Bucket ──────────────────────────────────────────────────────────────
	Bucket: {
		'': [
			{
				label: 'apiVersion',
				insertText: 'apiVersion: source.toolkit.fluxcd.io/v1beta2',
				detail: 'API version',
				documentation: 'The API version for this FluxCD resource.'
			},
			{
				label: 'kind',
				insertText: 'kind: Bucket',
				detail: 'Resource kind',
				documentation: 'Declares this resource as a FluxCD Bucket.'
			},
			{
				label: 'metadata',
				insertText: 'metadata:\n  name: \n  namespace: flux-system',
				detail: 'Resource metadata',
				documentation: 'Standard Kubernetes metadata.'
			},
			{
				label: 'spec',
				insertText: 'spec:',
				detail: 'Resource specification',
				documentation: 'The desired state of the Bucket source.'
			}
		],
		metadata: [
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Resource name',
				documentation: 'The unique name of the Bucket resource.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Namespace',
				documentation: 'The Kubernetes namespace to create this resource in.'
			},
			{
				label: 'labels',
				insertText: 'labels:\n  ',
				detail: 'Labels',
				documentation: 'Key-value labels.'
			},
			{
				label: 'annotations',
				insertText: 'annotations:\n  ',
				detail: 'Annotations',
				documentation: 'Arbitrary metadata.'
			}
		],
		spec: [
			{
				label: 'interval',
				insertText: 'interval: 1m',
				detail: 'Fetch interval',
				documentation: 'How often to download objects from the bucket.'
			},
			{
				label: 'bucketName',
				insertText: 'bucketName: ',
				detail: 'Bucket name',
				documentation: 'The name of the S3-compatible storage bucket.'
			},
			{
				label: 'endpoint',
				insertText: 'endpoint: ',
				detail: 'Endpoint URL',
				documentation:
					'The S3-compatible endpoint URL where the bucket is hosted (without the bucket name).'
			},
			{
				label: 'region',
				insertText: 'region: ',
				detail: 'Region',
				documentation: 'The cloud storage region where the bucket resides.'
			},
			{
				label: 'secretRef',
				insertText: 'secretRef:\n  name: ',
				detail: 'Auth secret',
				documentation: 'Reference to a Secret containing the bucket access key and secret key.'
			},
			{
				label: 'provider',
				insertText: 'provider: generic',
				detail: 'Storage provider',
				documentation: 'The S3-compatible platform. One of: `generic`, `aws`, `gcp`, `azure`.'
			},
			{
				label: 'insecure',
				insertText: 'insecure: false',
				detail: 'Allow insecure',
				documentation: 'When `true`, allows non-TLS HTTP connections to the endpoint.'
			},
			{
				label: 'timeout',
				insertText: 'timeout: 60s',
				detail: 'Operation timeout',
				documentation: 'The timeout for download operations.'
			},
			{
				label: 'suspend',
				insertText: 'suspend: false',
				detail: 'Suspend reconciliation',
				documentation: 'When `true`, stops reconciliation.'
			},
			{
				label: 'ignore',
				insertText: 'ignore: |',
				detail: 'Ignore patterns',
				documentation: 'Exclude files from the artifact using `.sourceignore` pattern syntax.'
			},
			{
				label: 'prefix',
				insertText: 'prefix: ',
				detail: 'Key prefix',
				documentation: 'A prefix to filter objects in the bucket by key path.'
			}
		]
	},

	// ─── Alert ───────────────────────────────────────────────────────────────
	Alert: {
		'': [
			{
				label: 'apiVersion',
				insertText: 'apiVersion: notification.toolkit.fluxcd.io/v1beta3',
				detail: 'API version',
				documentation: 'The API version for this FluxCD resource.'
			},
			{
				label: 'kind',
				insertText: 'kind: Alert',
				detail: 'Resource kind',
				documentation: 'Declares this resource as a FluxCD Alert.'
			},
			{
				label: 'metadata',
				insertText: 'metadata:\n  name: \n  namespace: flux-system',
				detail: 'Resource metadata',
				documentation: 'Standard Kubernetes metadata.'
			},
			{
				label: 'spec',
				insertText: 'spec:',
				detail: 'Resource specification',
				documentation: 'The desired state of the Alert.'
			}
		],
		metadata: [
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Resource name',
				documentation: 'The unique name of the Alert.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Namespace',
				documentation: 'The Kubernetes namespace to create this resource in.'
			},
			{
				label: 'labels',
				insertText: 'labels:\n  ',
				detail: 'Labels',
				documentation: 'Key-value labels.'
			},
			{
				label: 'annotations',
				insertText: 'annotations:\n  ',
				detail: 'Annotations',
				documentation: 'Arbitrary metadata.'
			}
		],
		spec: [
			{
				label: 'providerRef',
				insertText: 'providerRef:\n  name: ',
				detail: 'Provider reference',
				documentation: 'Reference to the Provider that will send notifications for this Alert.'
			},
			{
				label: 'eventSources',
				insertText: 'eventSources:\n  - kind: \n    name: "*"',
				detail: 'Event sources',
				documentation:
					'Filters events by the Kubernetes object kind and name. Use `"*"` to match all names.'
			},
			{
				label: 'severity',
				insertText: 'severity: info',
				detail: 'Alert severity',
				documentation:
					'The minimum event severity that triggers this Alert. One of: `info`, `error`.'
			},
			{
				label: 'summary',
				insertText: 'summary: ',
				detail: 'Impact summary',
				documentation:
					'A short description of the affected cluster component sent with each notification.'
			},
			{
				label: 'suspend',
				insertText: 'suspend: false',
				detail: 'Suspend alert',
				documentation: 'When `true`, stops processing events for this Alert.'
			},
			{
				label: 'exclusionList',
				insertText: 'exclusionList:\n  - ',
				detail: 'Exclusion patterns',
				documentation:
					'Golang regular expressions. Events whose message matches any pattern are excluded.'
			},
			{
				label: 'inclusionList',
				insertText: 'inclusionList:\n  - ',
				detail: 'Inclusion patterns',
				documentation:
					'Golang regular expressions. Only events whose message matches a pattern are included.'
			},
			{
				label: 'eventMetadata',
				insertText: 'eventMetadata:\n  ',
				detail: 'Event metadata',
				documentation: 'Extra key-value metadata to attach to dispatched events.'
			}
		]
	},

	// ─── Provider ────────────────────────────────────────────────────────────
	Provider: {
		'': [
			{
				label: 'apiVersion',
				insertText: 'apiVersion: notification.toolkit.fluxcd.io/v1beta3',
				detail: 'API version',
				documentation: 'The API version for this FluxCD resource.'
			},
			{
				label: 'kind',
				insertText: 'kind: Provider',
				detail: 'Resource kind',
				documentation: 'Declares this resource as a FluxCD Provider.'
			},
			{
				label: 'metadata',
				insertText: 'metadata:\n  name: \n  namespace: flux-system',
				detail: 'Resource metadata',
				documentation: 'Standard Kubernetes metadata.'
			},
			{
				label: 'spec',
				insertText: 'spec:',
				detail: 'Resource specification',
				documentation: 'The desired state of the Provider.'
			}
		],
		metadata: [
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Resource name',
				documentation: 'The unique name of the Provider.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Namespace',
				documentation: 'The Kubernetes namespace to create this resource in.'
			},
			{
				label: 'labels',
				insertText: 'labels:\n  ',
				detail: 'Labels',
				documentation: 'Key-value labels.'
			},
			{
				label: 'annotations',
				insertText: 'annotations:\n  ',
				detail: 'Annotations',
				documentation: 'Arbitrary metadata.'
			}
		],
		spec: [
			{
				label: 'type',
				insertText: 'type: slack',
				detail: 'Provider type',
				documentation:
					'The notification provider platform.\n\n**Supported:** `slack`, `discord`, `msteams`, `googlechat`, `telegram`, `matrix`, `lark`, `rocket`, `webex`, `sentry`, `pagerduty`, `opsgenie`, `datadog`, `grafana`, `github`, `gitlab`, `gitea`, `bitbucket`, `azuredevops`, `alertmanager`, `generic`, `generic-hmac`'
			},
			{
				label: 'address',
				insertText: 'address: ',
				detail: 'Webhook URL',
				documentation: 'The URL of the webhook endpoint to send notifications to.'
			},
			{
				label: 'channel',
				insertText: 'channel: ',
				detail: 'Channel name',
				documentation: 'The Slack or Discord channel name to post notifications to.'
			},
			{
				label: 'username',
				insertText: 'username: flux',
				detail: 'Bot username',
				documentation: 'The display name of the bot posting notifications.'
			},
			{
				label: 'secretRef',
				insertText: 'secretRef:\n  name: ',
				detail: 'Token secret',
				documentation: 'Reference to a Secret containing the authentication token or HMAC key.'
			},
			{
				label: 'timeout',
				insertText: 'timeout: 20s',
				detail: 'Request timeout',
				documentation: 'The timeout for sending notifications to this Provider.'
			},
			{
				label: 'suspend',
				insertText: 'suspend: false',
				detail: 'Suspend provider',
				documentation: 'When `true`, stops forwarding events to this Provider.'
			},
			{
				label: 'proxy',
				insertText: 'proxy: ',
				detail: 'HTTP proxy',
				documentation: 'The HTTP/S proxy URL for outbound notification requests.'
			},
			{
				label: 'certSecretRef',
				insertText: 'certSecretRef:\n  name: ',
				detail: 'TLS cert secret',
				documentation: 'Reference to a Secret containing TLS certificate data.'
			}
		]
	},

	// ─── Receiver ────────────────────────────────────────────────────────────
	Receiver: {
		'': [
			{
				label: 'apiVersion',
				insertText: 'apiVersion: notification.toolkit.fluxcd.io/v1',
				detail: 'API version',
				documentation: 'The API version for this FluxCD resource.'
			},
			{
				label: 'kind',
				insertText: 'kind: Receiver',
				detail: 'Resource kind',
				documentation: 'Declares this resource as a FluxCD Receiver.'
			},
			{
				label: 'metadata',
				insertText: 'metadata:\n  name: \n  namespace: flux-system',
				detail: 'Resource metadata',
				documentation: 'Standard Kubernetes metadata.'
			},
			{
				label: 'spec',
				insertText: 'spec:',
				detail: 'Resource specification',
				documentation: 'The desired state of the Receiver.'
			}
		],
		metadata: [
			{
				label: 'name',
				insertText: 'name: ',
				detail: 'Resource name',
				documentation: 'The unique name of the Receiver.'
			},
			{
				label: 'namespace',
				insertText: 'namespace: flux-system',
				detail: 'Namespace',
				documentation: 'The Kubernetes namespace to create this resource in.'
			},
			{
				label: 'labels',
				insertText: 'labels:\n  ',
				detail: 'Labels',
				documentation: 'Key-value labels.'
			},
			{
				label: 'annotations',
				insertText: 'annotations:\n  ',
				detail: 'Annotations',
				documentation: 'Arbitrary metadata.'
			}
		],
		spec: [
			{
				label: 'type',
				insertText: 'type: generic',
				detail: 'Receiver type',
				documentation:
					'The webhook sender type. One of: `generic`, `github`, `gitlab`, `bitbucket`, `harbor`, `quay`, `gcr`, `nexus`, `acr`.'
			},
			{
				label: 'interval',
				insertText: 'interval: 1h',
				detail: 'Token rotation interval',
				documentation:
					'How often to reconcile the Receiver token stored in the Status. Defaults to 1h.'
			},
			{
				label: 'events',
				insertText: 'events:\n  - push\n  - ping',
				detail: 'Webhook events',
				documentation:
					'The list of webhook event types to handle. Provider-specific (e.g., GitHub: `push`, `pull_request`).'
			},
			{
				label: 'resources',
				insertText: 'resources:\n  - kind: GitRepository\n    name: "*"',
				detail: 'Managed resources',
				documentation:
					'The Flux resources that are triggered by incoming webhook events. Use `"*"` for all names.'
			},
			{
				label: 'secretRef',
				insertText: 'secretRef:\n  name: ',
				detail: 'HMAC secret',
				documentation:
					'Reference to a Secret containing the HMAC key used to validate incoming webhook payloads.'
			},
			{
				label: 'suspend',
				insertText: 'suspend: false',
				detail: 'Suspend receiver',
				documentation: 'When `true`, stops handling incoming webhook events.'
			}
		]
	}
};

/** Extract the `kind:` value from YAML lines. */
function extractKind(lines: string[]): string {
	for (const line of lines) {
		const match = line.match(/^kind:\s*(\w+)/);
		if (match) return match[1];
	}
	return '';
}

/**
 * Build a dot-separated parent path by walking lines above the cursor
 * and tracking indentation levels.
 */
function getParentPath(lines: string[], cursorLineIndex: number, currentIndent: number): string {
	const path: string[] = [];
	let targetIndent = currentIndent;

	for (let i = cursorLineIndex - 1; i >= 0; i--) {
		const line = lines[i];
		if (!line.trim() || line.trim().startsWith('#')) continue;

		const lineIndent = line.match(/^(\s*)/)?.[1].length ?? 0;

		if (lineIndent < targetIndent) {
			// Strip leading `- ` for list items before extracting the key
			const keyMatch = line.match(/^[\s-]*(\w[\w-]*)\s*:/);
			if (keyMatch) {
				path.unshift(keyMatch[1]);
				targetIndent = lineIndent;
			}
		}

		if (targetIndent === 0) break;
	}

	return path.join('.');
}

/**
 * Determine whether the cursor is positioned to complete a YAML value
 * (i.e., after `key: ` on the current line) and return the field name.
 */
function getValueCompletionContext(line: string, cursorColumn: number): string | null {
	const textBeforeCursor = line.substring(0, cursorColumn - 1);
	const valueMatch = textBeforeCursor.match(/^\s*([\w-]+):\s*$/);
	return valueMatch ? valueMatch[1] : null;
}

/**
 * Register FluxCD-aware YAML completions and hover documentation in Monaco.
 * Safe to call multiple times — registers only once.
 */
export function registerFluxLanguageFeatures(monaco: typeof Monaco): void {
	if (featuresRegistered) return;
	featuresRegistered = true;

	// ── Completion Provider ──────────────────────────────────────────────────
	monaco.languages.registerCompletionItemProvider('yaml', {
		triggerCharacters: ['\n', ' ', ':'],

		provideCompletionItems(
			model: Monaco.editor.ITextModel,
			position: Monaco.Position
		): Monaco.languages.CompletionList {
			const lines = model.getLinesContent();
			const lineIndex = position.lineNumber - 1;
			const currentLine = lines[lineIndex];
			const kind = extractKind(lines);
			const lineIndent = currentLine.match(/^(\s*)/)?.[1].length ?? 0;

			// ── Value completion (after `key: `) ────────────────────────────
			const fieldName = getValueCompletionContext(currentLine, position.column);
			if (fieldName && kind) {
				const valParentPath = getParentPath(lines, lineIndex, lineIndent);
				const pathKey = `${kind}.${valParentPath}.${fieldName}`;
				const enumValues = VALUE_COMPLETIONS_BY_PATH[pathKey] ?? VALUE_COMPLETIONS[fieldName];
				if (enumValues) {
					const range = new monaco.Range(
						position.lineNumber,
						position.column,
						position.lineNumber,
						position.column
					);
					return {
						suggestions: enumValues.map((val) => ({
							label: val,
							kind: monaco.languages.CompletionItemKind.Value,
							insertText: val,
							range,
							detail: fieldName
						}))
					};
				}
			}

			// ── Key completion ───────────────────────────────────────────────
			// Only trigger for lines that are empty or contain only whitespace up to cursor
			const beforeCursor = currentLine.substring(0, position.column - 1);
			if (beforeCursor.trim() !== '') return { suggestions: [] };

			// Determine the effective indentation (may differ from line content
			// when the user has typed spaces but not yet a key)
			const currentIndent = Math.max(lineIndent, position.column - 1);

			if (!kind || !SCHEMA[kind]) return { suggestions: [] };

			const parentPath = getParentPath(lines, lineIndex, currentIndent);
			const completions = SCHEMA[kind][parentPath];
			if (!completions) return { suggestions: [] };

			// Use the word at/before position to determine the replace range
			const wordInfo = model.getWordUntilPosition(position);
			const replaceRange = new monaco.Range(
				position.lineNumber,
				wordInfo.startColumn,
				position.lineNumber,
				wordInfo.endColumn
			);

			const baseIndent = ' '.repeat(currentIndent);
			return {
				suggestions: completions.map((item) => {
					// Re-indent multiline snippets so continuation lines align
					// with the surrounding document indentation.
					const insertText = item.insertText.includes('\n')
						? item.insertText
								.split('\n')
								.map((line, i) => (i === 0 ? line : baseIndent + line))
								.join('\n')
						: item.insertText;

					return {
						label: item.label,
						kind: monaco.languages.CompletionItemKind.Field,
						detail: item.detail,
						documentation: { value: item.documentation },
						insertText,
						insertTextRules: monaco.languages.CompletionItemInsertTextRule.None,
						range: replaceRange
					};
				})
			};
		}
	});

	// ── Hover Provider ───────────────────────────────────────────────────────
	monaco.languages.registerHoverProvider('yaml', {
		provideHover(
			model: Monaco.editor.ITextModel,
			position: Monaco.Position
		): Monaco.languages.Hover | null {
			const word = model.getWordAtPosition(position);
			if (!word) return null;

			const lines = model.getLinesContent();
			const lineIndex = position.lineNumber - 1;
			const currentLine = lines[lineIndex];

			// Only show hover when the word is at a key position (followed by `:`)
			const afterWord = currentLine.substring(word.endColumn - 1).trimStart();
			if (!afterWord.startsWith(':')) return null;

			// Look up schema entry for context-specific documentation
			const kind = extractKind(lines);
			const lineIndent = currentLine.match(/^(\s*)/)?.[1].length ?? 0;
			const parentPath = getParentPath(lines, lineIndex, lineIndent);
			const schemaCompletions = kind && SCHEMA[kind] ? SCHEMA[kind][parentPath] : [];
			const schemaEntry = schemaCompletions?.find((c) => c.label === word.word);

			// Use schema documentation as primary; fall back to generic FIELD_HOVER_DOCS
			const markdownDoc =
				schemaEntry?.documentation ?? FIELD_HOVER_DOCS[word.word as keyof typeof FIELD_HOVER_DOCS];
			if (!markdownDoc) return null;

			return {
				range: new monaco.Range(
					position.lineNumber,
					word.startColumn,
					position.lineNumber,
					word.endColumn
				),
				contents: [
					{
						value: `**${word.word}** — ${schemaEntry?.detail ?? 'FluxCD field'}`
					},
					{ value: markdownDoc }
				]
			};
		}
	});
}
