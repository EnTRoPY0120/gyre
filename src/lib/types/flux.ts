// Re-export backend types
export type {
	K8sMetadata,
	K8sCondition,
	FluxResource,
	FluxResourceStatus,
	FluxResourceList,
	GitRepository,
	GitRepositorySpec,
	HelmRelease,
	HelmReleaseSpec,
	Kustomization,
	KustomizationSpec
} from '$lib/server/kubernetes/flux/types';

/**
 * All FluxCD resource types
 */
export enum FluxResourceType {
	// Source Controller
	GitRepository = 'gitrepositories',
	HelmRepository = 'helmrepositories',
	HelmChart = 'helmcharts',
	Bucket = 'buckets',
	OCIRepository = 'ocirepositories',

	// Kustomize Controller
	Kustomization = 'kustomizations',

	// Helm Controller
	HelmRelease = 'helmreleases',

	// Notification Controller
	Alert = 'alerts',
	Provider = 'providers',
	Receiver = 'receivers',

	// Image Automation
	ImageRepository = 'imagerepositories',
	ImagePolicy = 'imagepolicies',
	ImageUpdateAutomation = 'imageupdateautomations'
}

/**
 * Resource group for navigation
 */
export interface ResourceGroup {
	name: string;
	icon: string;
	resources: ResourceInfo[];
}

/**
 * Individual resource info
 */
export interface ResourceInfo {
	type: FluxResourceType;
	displayName: string;
	singularName: string;
	apiVersion: string;
	kind: string;
	description: string;
}
