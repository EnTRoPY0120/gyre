/**
 * FluxCD Resource Definition
 * All FluxCD CRDs follow this structure for API calls
 */
export interface FluxResourceDef {
	group: string;
	version: string;
	plural: string;
	kind: string;
	apiVersion: string;
	namespaced: boolean;
	controller: string;
}

/**
 * All 13 FluxCD resource types supported by Gyre
 */
export const FLUX_RESOURCES = {
	// Source Controller (source.toolkit.fluxcd.io/v1)
	GitRepository: {
		group: 'source.toolkit.fluxcd.io',
		version: 'v1',
		plural: 'gitrepositories',
		kind: 'GitRepository',
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		namespaced: true,
		controller: 'source-controller'
	},
	HelmRepository: {
		group: 'source.toolkit.fluxcd.io',
		version: 'v1',
		plural: 'helmrepositories',
		kind: 'HelmRepository',
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		namespaced: true,
		controller: 'source-controller'
	},
	HelmChart: {
		group: 'source.toolkit.fluxcd.io',
		version: 'v1',
		plural: 'helmcharts',
		kind: 'HelmChart',
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		namespaced: true,
		controller: 'source-controller'
	},
	Bucket: {
		group: 'source.toolkit.fluxcd.io',
		version: 'v1',
		plural: 'buckets',
		kind: 'Bucket',
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		namespaced: true,
		controller: 'source-controller'
	},
	OCIRepository: {
		group: 'source.toolkit.fluxcd.io',
		version: 'v1beta2',
		plural: 'ocirepositories',
		kind: 'OCIRepository',
		apiVersion: 'source.toolkit.fluxcd.io/v1beta2',
		namespaced: true,
		controller: 'source-controller'
	},

	// Kustomize Controller (kustomize.toolkit.fluxcd.io/v1)
	Kustomization: {
		group: 'kustomize.toolkit.fluxcd.io',
		version: 'v1',
		plural: 'kustomizations',
		kind: 'Kustomization',
		apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
		namespaced: true,
		controller: 'kustomize-controller'
	},

	// Helm Controller (helm.toolkit.fluxcd.io/v2)
	HelmRelease: {
		group: 'helm.toolkit.fluxcd.io',
		version: 'v2',
		plural: 'helmreleases',
		kind: 'HelmRelease',
		apiVersion: 'helm.toolkit.fluxcd.io/v2',
		namespaced: true,
		controller: 'helm-controller'
	},

	// Notification Controller (notification.toolkit.fluxcd.io)
	Alert: {
		group: 'notification.toolkit.fluxcd.io',
		version: 'v1beta3',
		plural: 'alerts',
		kind: 'Alert',
		apiVersion: 'notification.toolkit.fluxcd.io/v1beta3',
		namespaced: true,
		controller: 'notification-controller'
	},
	Provider: {
		group: 'notification.toolkit.fluxcd.io',
		version: 'v1beta3',
		plural: 'providers',
		kind: 'Provider',
		apiVersion: 'notification.toolkit.fluxcd.io/v1beta3',
		namespaced: true,
		controller: 'notification-controller'
	},
	Receiver: {
		group: 'notification.toolkit.fluxcd.io',
		version: 'v1',
		plural: 'receivers',
		kind: 'Receiver',
		apiVersion: 'notification.toolkit.fluxcd.io/v1',
		namespaced: true,
		controller: 'notification-controller'
	},

	// Image Automation Controller (image.toolkit.fluxcd.io/v1)
	ImageRepository: {
		group: 'image.toolkit.fluxcd.io',
		version: 'v1beta2',
		plural: 'imagerepositories',
		kind: 'ImageRepository',
		apiVersion: 'image.toolkit.fluxcd.io/v1beta2',
		namespaced: true,
		controller: 'image-reflector-controller'
	},
	ImagePolicy: {
		group: 'image.toolkit.fluxcd.io',
		version: 'v1beta2',
		plural: 'imagepolicies',
		kind: 'ImagePolicy',
		apiVersion: 'image.toolkit.fluxcd.io/v1beta2',
		namespaced: true,
		controller: 'image-reflector-controller'
	},
	ImageUpdateAutomation: {
		group: 'image.toolkit.fluxcd.io',
		version: 'v1beta2',
		plural: 'imageupdateautomations',
		kind: 'ImageUpdateAutomation',
		apiVersion: 'image.toolkit.fluxcd.io/v1beta2',
		namespaced: true,
		controller: 'image-automation-controller'
	}
} as const;

export type FluxResourceType = keyof typeof FLUX_RESOURCES;

/**
 * Lookup resource definition by type string
 */
export function getResourceDef(resourceType: string): FluxResourceDef | undefined {
	return FLUX_RESOURCES[resourceType as FluxResourceType];
}

/**
 * Get all resource types
 */
export function getAllResourceTypes(): FluxResourceType[] {
	return Object.keys(FLUX_RESOURCES) as FluxResourceType[];
}

/**
 * Get all plural resource names (lowercase, for URL matching)
 */
export function getAllResourcePlurals(): string[] {
	return Object.values(FLUX_RESOURCES).map((r) => r.plural);
}

/**
 * Lookup resource type by plural name (e.g., 'gitrepositories' -> 'GitRepository')
 */
export function getResourceTypeByPlural(plural: string): FluxResourceType | undefined {
	for (const [key, def] of Object.entries(FLUX_RESOURCES)) {
		if (def.plural === plural) {
			return key as FluxResourceType;
		}
	}
	return undefined;
}
