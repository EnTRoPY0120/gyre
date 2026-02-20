import { listFluxResources } from '$lib/server/kubernetes/client';
import { type FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import {
	buildRelationshipMap,
	type FluxResource as RelationshipsFluxResource
} from '$lib/utils/relationships';
import type { FluxResource as ServerFluxResource } from '$lib/server/kubernetes/flux/types';

export async function getInventoryData(context: string | undefined) {
	// Fetch all Flux resources to build the relationship map
	const resourceTypes: FluxResourceType[] = [
		'Kustomization',
		'HelmRelease',
		'GitRepository',
		'HelmRepository',
		'OCIRepository',
		'Bucket',
		'Alert',
		'Provider',
		'Receiver',
		'ImagePolicy',
		'ImageRepository',
		'ImageUpdateAutomation'
	];

	const results = await Promise.all(
		resourceTypes.map(async (type) => {
			try {
				const data = await listFluxResources(type, context);
				return { type, items: data.items || [] };
			} catch (error) {
				console.warn(`Failed to list ${type}`, error);
				return { type, items: [] };
			}
		})
	);

	// Map results to named arrays
	const resourceMap: Record<string, ServerFluxResource[]> = {};
	results.forEach((r) => {
		resourceMap[r.type] = r.items;
	});

	// Build relationships
	const relationships = buildRelationshipMap({
		kustomizations: resourceMap['Kustomization'] as RelationshipsFluxResource[],
		helmReleases: resourceMap['HelmRelease'] as RelationshipsFluxResource[],
		gitRepositories: resourceMap['GitRepository'] as RelationshipsFluxResource[],
		helmRepositories: resourceMap['HelmRepository'] as RelationshipsFluxResource[],
		ociRepositories: resourceMap['OCIRepository'] as RelationshipsFluxResource[],
		buckets: resourceMap['Bucket'] as RelationshipsFluxResource[],
		alerts: resourceMap['Alert'] as RelationshipsFluxResource[],
		providers: resourceMap['Provider'] as RelationshipsFluxResource[],
		receivers: resourceMap['Receiver'] as RelationshipsFluxResource[],
		imagePolicies: resourceMap['ImagePolicy'] as RelationshipsFluxResource[],
		imageRepositories: resourceMap['ImageRepository'] as RelationshipsFluxResource[],
		imageUpdateAutomations: resourceMap['ImageUpdateAutomation'] as RelationshipsFluxResource[]
	});

	// Flatten all resources into a single array for easier consumption
	const allResources = Object.values(resourceMap).flat();

	return {
		resourceMap,
		relationships,
		allResources
	};
}
