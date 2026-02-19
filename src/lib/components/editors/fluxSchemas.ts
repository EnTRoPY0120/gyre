/**
 * FluxCD CRD validation schemas for Monaco editor semantic validation.
 * Used by yamlValidator.ts to produce inline diagnostics.
 */

/** Valid apiVersions for each FluxCD resource Kind. */
export const KIND_API_VERSIONS: Readonly<Record<string, string[]>> = {
	GitRepository: ['source.toolkit.fluxcd.io/v1', 'source.toolkit.fluxcd.io/v1beta2'],
	Kustomization: ['kustomize.toolkit.fluxcd.io/v1', 'kustomize.toolkit.fluxcd.io/v1beta2'],
	HelmRelease: [
		'helm.toolkit.fluxcd.io/v2',
		'helm.toolkit.fluxcd.io/v2beta2',
		'helm.toolkit.fluxcd.io/v2beta1'
	],
	HelmRepository: ['source.toolkit.fluxcd.io/v1', 'source.toolkit.fluxcd.io/v1beta2'],
	HelmChart: ['source.toolkit.fluxcd.io/v1', 'source.toolkit.fluxcd.io/v1beta2'],
	OCIRepository: ['source.toolkit.fluxcd.io/v1beta2'],
	Bucket: ['source.toolkit.fluxcd.io/v1', 'source.toolkit.fluxcd.io/v1beta2'],
	Alert: ['notification.toolkit.fluxcd.io/v1beta3', 'notification.toolkit.fluxcd.io/v1beta2'],
	Provider: ['notification.toolkit.fluxcd.io/v1beta3', 'notification.toolkit.fluxcd.io/v1beta2'],
	Receiver: ['notification.toolkit.fluxcd.io/v1', 'notification.toolkit.fluxcd.io/v1beta2'],
	ImageRepository: ['image.toolkit.fluxcd.io/v1beta2'],
	ImagePolicy: ['image.toolkit.fluxcd.io/v1beta2'],
	ImageUpdateAutomation: ['image.toolkit.fluxcd.io/v1beta2']
};

/** Required fields within spec for each FluxCD Kind. */
export const KIND_REQUIRED_SPEC: Readonly<Record<string, string[]>> = {
	GitRepository: ['url', 'interval'],
	Kustomization: ['interval', 'prune', 'sourceRef'],
	HelmRelease: ['chart', 'interval'],
	HelmRepository: ['url', 'interval'],
	HelmChart: ['chart', 'interval', 'sourceRef'],
	OCIRepository: ['url', 'interval'],
	Bucket: ['endpoint', 'interval', 'bucketName'],
	Alert: ['eventSources', 'providerRef'],
	Provider: ['type'],
	Receiver: ['type', 'events', 'resources'],
	ImageRepository: ['image', 'interval'],
	ImagePolicy: ['imageRepositoryRef'],
	ImageUpdateAutomation: ['interval', 'sourceRef', 'git']
};

/**
 * Enum values for specific spec fields.
 * Key format: `"Kind.dot.separated.path"` where path is relative to the spec root.
 * Checked in order: nested path (e.g. `Kind.parent.field`) before top-level (`Kind.field`).
 */
export const KIND_SPEC_ENUMS: Readonly<Record<string, readonly string[]>> = {
	'Alert.eventSeverity': ['info', 'error'],
	'Provider.type': [
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
	'Receiver.type': [
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
	'HelmRepository.type': ['default', 'oci'],
	'Kustomization.decryption.provider': ['sops'],
	'GitRepository.verification.provider': ['openpgp', 'cosign']
};

/** Spec fields that must be a YAML boolean (`true` / `false`). */
export const SPEC_BOOLEAN_FIELDS: ReadonlySet<string> = new Set([
	'suspend',
	'prune',
	'force',
	'wait',
	'insecure',
	'recurseSubmodules',
	'passCredentials'
]);

/** Spec fields that must be a duration string (e.g., `30s`, `5m`, `1h`). */
export const SPEC_DURATION_FIELDS: ReadonlySet<string> = new Set([
	'interval',
	'timeout',
	'retryInterval',
	'pollInterval',
	'ttl'
]);

/** Duration string pattern: a positive number followed by a time unit. */
export const DURATION_PATTERN = /^\d+(\.\d+)?(ms|s|m|h)$/;
