import type { PageServerLoad } from './$types';
import { getInventoryData } from '$lib/server/inventory-data';
import { detectCircularDependencies } from '$lib/utils/relationships';

export const load: PageServerLoad = async ({ locals }) => {
	const { allResources, relationships } = await getInventoryData(locals.cluster);
	const circularIds = detectCircularDependencies(relationships);

	return {
		allResources,
		relationships,
		circularIds,
		totalResources: allResources.length,
		totalRelationships: relationships.length
	};
};
