import { FluxResourceType, type ResourceGroup, type ResourceInfo } from '$lib/types/flux';

/**
 * All FluxCD resource configurations organized by category
 */
export const resourceGroups: ResourceGroup[] = [
	{
		name: 'Sources',
		icon: 'sideways-git',
		primaryRoute: FluxResourceType.GitRepository,
		resources: [
			{
				type: FluxResourceType.GitRepository,
				displayName: 'Git Repositories',
				singularName: 'Git Repository',
				apiVersion: 'source.toolkit.fluxcd.io/v1',
				kind: 'GitRepository',
				description: 'Git repository sources for Flux'
			},
			{
				type: FluxResourceType.HelmRepository,
				displayName: 'Helm Repositories',
				singularName: 'Helm Repository',
				apiVersion: 'source.toolkit.fluxcd.io/v1',
				kind: 'HelmRepository',
				description: 'Helm chart repositories'
			},
			{
				type: FluxResourceType.HelmChart,
				displayName: 'Helm Charts',
				singularName: 'Helm Chart',
				apiVersion: 'source.toolkit.fluxcd.io/v1',
				kind: 'HelmChart',
				description: 'Helm charts from repositories'
			},
			{
				type: FluxResourceType.Bucket,
				displayName: 'Buckets',
				singularName: 'Bucket',
				apiVersion: 'source.toolkit.fluxcd.io/v1beta2',
				kind: 'Bucket',
				description: 'S3-compatible bucket sources'
			},
			{
				type: FluxResourceType.OCIRepository,
				displayName: 'OCI Repositories',
				singularName: 'OCI Repository',
				apiVersion: 'source.toolkit.fluxcd.io/v1',
				kind: 'OCIRepository',
				description: 'OCI artifact repositories'
			}
		]
	},
	{
		name: 'Kustomize',
		icon: 'kustomize',
		primaryRoute: FluxResourceType.Kustomization,
		resources: [
			{
				type: FluxResourceType.Kustomization,
				displayName: 'Kustomizations',
				singularName: 'Kustomization',
				apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
				kind: 'Kustomization',
				description: 'Kustomize deployments'
			}
		]
	},
	{
		name: 'Helm',
		icon: 'helm',
		primaryRoute: FluxResourceType.HelmRelease,
		resources: [
			{
				type: FluxResourceType.HelmRelease,
				displayName: 'Helm Releases',
				singularName: 'Helm Release',
				apiVersion: 'helm.toolkit.fluxcd.io/v2',
				kind: 'HelmRelease',
				description: 'Helm release deployments'
			}
		]
	},
	{
		name: 'Notifications',
		icon: 'bell',
		primaryRoute: FluxResourceType.Alert,
		resources: [
			{
				type: FluxResourceType.Alert,
				displayName: 'Alerts',
				singularName: 'Alert',
				apiVersion: 'notification.toolkit.fluxcd.io/v1beta3',
				kind: 'Alert',
				description: 'Alert definitions for events'
			},
			{
				type: FluxResourceType.Provider,
				displayName: 'Providers',
				singularName: 'Provider',
				apiVersion: 'notification.toolkit.fluxcd.io/v1beta3',
				kind: 'Provider',
				description: 'Notification providers (Slack, Discord, etc.)'
			},
			{
				type: FluxResourceType.Receiver,
				displayName: 'Receivers',
				singularName: 'Receiver',
				apiVersion: 'notification.toolkit.fluxcd.io/v1',
				kind: 'Receiver',
				description: 'Webhook receivers for external events'
			}
		]
	},
	{
		name: 'Image Automation',
		icon: 'layers',
		primaryRoute: FluxResourceType.ImageRepository,
		resources: [
			{
				type: FluxResourceType.ImageRepository,
				displayName: 'Image Repositories',
				singularName: 'Image Repository',
				apiVersion: 'image.toolkit.fluxcd.io/v1',
				kind: 'ImageRepository',
				description: 'Container image repositories to scan'
			},
			{
				type: FluxResourceType.ImagePolicy,
				displayName: 'Image Policies',
				singularName: 'Image Policy',
				apiVersion: 'image.toolkit.fluxcd.io/v1',
				kind: 'ImagePolicy',
				description: 'Policies for selecting image versions'
			},
			{
				type: FluxResourceType.ImageUpdateAutomation,
				displayName: 'Image Update Automations',
				singularName: 'Image Update Automation',
				apiVersion: 'image.toolkit.fluxcd.io/v1',
				kind: 'ImageUpdateAutomation',
				description: 'Automated image updates to Git'
			}
		]
	}
];

const allResources: ResourceInfo[] = resourceGroups.flatMap((group) => group.resources);

/**
 * Get resource info by type
 */
export function getResourceInfo(type: string) {
	return allResources.find((resource) => resource.type === type) ?? null;
}

/**
 * Get resource info by canonical kind name
 */
export function getResourceInfoByKind(kind: string) {
	return allResources.find((resource) => resource.kind === kind) ?? null;
}

/**
 * Resolve either a plural route type or canonical kind to the route type
 */
export function resolveResourceRouteType(typeOrKind: string): FluxResourceType | null {
	return getResourceInfo(typeOrKind)?.type ?? getResourceInfoByKind(typeOrKind)?.type ?? null;
}

/**
 * Resolve either a plural route type or canonical kind to the canonical kind
 */
export function resolveResourceKind(typeOrKind: string): string | null {
	return getResourceInfo(typeOrKind)?.kind ?? getResourceInfoByKind(typeOrKind)?.kind ?? null;
}

/**
 * Get all resource types
 */
export function getAllResourceTypes(): string[] {
	return allResources.map((resource) => resource.type);
}
