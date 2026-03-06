import { FluxResourceType, type ResourceGroup } from '$lib/types/flux';

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
				apiVersion: 'source.toolkit.fluxcd.io/v1beta2',
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
				apiVersion: 'image.toolkit.fluxcd.io/v1beta2',
				kind: 'ImageRepository',
				description: 'Container image repositories to scan'
			},
			{
				type: FluxResourceType.ImagePolicy,
				displayName: 'Image Policies',
				singularName: 'Image Policy',
				apiVersion: 'image.toolkit.fluxcd.io/v1beta2',
				kind: 'ImagePolicy',
				description: 'Policies for selecting image versions'
			},
			{
				type: FluxResourceType.ImageUpdateAutomation,
				displayName: 'Image Update Automations',
				singularName: 'Image Update Automation',
				apiVersion: 'image.toolkit.fluxcd.io/v1beta2',
				kind: 'ImageUpdateAutomation',
				description: 'Automated image updates to Git'
			}
		]
	}
];

/**
 * Get resource info by type
 */
export function getResourceInfo(type: string) {
	for (const group of resourceGroups) {
		const resource = group.resources.find((r) => r.type === type);
		if (resource) return resource;
	}
	return null;
}

/**
 * Get all resource types
 */
export function getAllResourceTypes(): string[] {
	return resourceGroups.flatMap((group) => group.resources.map((r) => r.type));
}
