import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listFluxResources } from '$lib/server/kubernetes/client';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	// Check permission for image automation resources
	// We check for 'read' permission on 'imagerepositories' as a proxy for the whole group
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		'imagerepositories',
		undefined,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	const context = locals.cluster;

	try {
		// Fetch all relevant resources in parallel
		const [imageRepos, imagePolicies, imageAutomations] = await Promise.all([
			listFluxResources('ImageRepository' as FluxResourceType, context),
			listFluxResources('ImagePolicy' as FluxResourceType, context),
			listFluxResources('ImageUpdateAutomation' as FluxResourceType, context)
		]);

		return {
			imageRepositories: imageRepos.items || [],
			imagePolicies: imagePolicies.items || [],
			imageUpdateAutomations: imageAutomations.items || []
		};
	} catch (e) {
		console.error('Error loading image automation dashboard data:', e);
		return {
			imageRepositories: [],
			imagePolicies: [],
			imageUpdateAutomations: [],
			error: 'Failed to load resources from cluster'
		};
	}
};
