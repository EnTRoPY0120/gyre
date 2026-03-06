/**
 * Base Kubernetes metadata
 */
export interface K8sMetadata {
	name: string;
	namespace?: string;
	uid?: string;
	resourceVersion?: string;
	generation?: number;
	creationTimestamp?: string;
	deletionTimestamp?: string;
	labels?: Record<string, string>;
	annotations?: Record<string, string>;
	finalizers?: string[];
}

/**
 * Kubernetes condition
 */
export interface K8sCondition {
	type: string;
	status: 'True' | 'False' | 'Unknown';
	lastTransitionTime?: string;
	reason?: string;
	message?: string;
	observedGeneration?: number;
}

/**
 * Base FluxCD resource
 */
export interface FluxResource {
	apiVersion: string;
	kind: string;
	metadata: K8sMetadata;
	spec?: Record<string, unknown>;
	status?: FluxResourceStatus;
}

/**
 * FluxCD resource status (common fields)
 */
export interface FluxResourceStatus {
	conditions?: K8sCondition[];
	observedGeneration?: number;
	lastAppliedRevision?: string;
	lastAttemptedRevision?: string;
	artifact?: {
		path: string;
		url: string;
		revision: string;
		checksum?: string;
		lastUpdateTime?: string;
	};
}

/**
 * List of FluxCD resources
 */
export interface FluxResourceList {
	apiVersion: string;
	kind: string;
	metadata: {
		resourceVersion?: string;
		continue?: string;
	};
	items: FluxResource[];
}

/**
 * GitRepository-specific types
 */
export interface GitRepositorySpec extends Record<string, unknown> {
	url: string;
	interval: string;
	ref?: {
		branch?: string;
		tag?: string;
		semver?: string;
		commit?: string;
	};
	secretRef?: {
		name: string;
	};
	timeout?: string;
	ignore?: string;
}

export interface GitRepository extends FluxResource {
	spec: GitRepositorySpec;
}

/**
 * HelmRelease-specific types
 */
export interface HelmReleaseSpec extends Record<string, unknown> {
	chart: {
		spec: {
			chart: string;
			version?: string;
			sourceRef: {
				kind: string;
				name: string;
				namespace?: string;
			};
		};
	};
	interval: string;
	releaseName?: string;
	targetNamespace?: string;
	values?: Record<string, unknown>;
	suspend?: boolean;
}

export interface HelmRelease extends FluxResource {
	spec: HelmReleaseSpec;
}

/**
 * Kustomization-specific types
 */
export interface KustomizationSpec extends Record<string, unknown> {
	interval: string;
	sourceRef: {
		kind: string;
		name: string;
		namespace?: string;
	};
	path?: string;
	prune?: boolean;
	suspend?: boolean;
	timeout?: string;
	force?: boolean;
	targetNamespace?: string;
}

export interface Kustomization extends FluxResource {
	spec: KustomizationSpec;
}
