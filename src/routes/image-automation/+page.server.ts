import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listFluxResources } from '$lib/server/kubernetes/client';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	const user = locals.user;
	if (!user) {
		throw error(401, { message: 'Authentication required' });
	}

	// Check permission for all image automation resources
	const requiredResources = ['imagerepositories', 'imagepolicies', 'imageupdateautomations'];
	const permissionResults = await Promise.all(
		requiredResources.map((resource) =>
			checkPermission(user, 'read', resource, undefined, locals.cluster)
		)
	);

	if (permissionResults.some((hasPerm) => !hasPerm)) {
		throw error(403, { message: 'Permission denied' });
	}

	const context = locals.cluster;

	const IMAGE_REPOSITORY: FluxResourceType = 'ImageRepository';
	const IMAGE_POLICY: FluxResourceType = 'ImagePolicy';
	const IMAGE_UPDATE_AUTOMATION: FluxResourceType = 'ImageUpdateAutomation';

	try {
		const reqCache = new Map();

		// Fetch all relevant resources in parallel
		const [imageRepos, imagePolicies, imageAutomations] = await Promise.all([
			listFluxResources(IMAGE_REPOSITORY, context, reqCache),
			listFluxResources(IMAGE_POLICY, context, reqCache),
			listFluxResources(IMAGE_UPDATE_AUTOMATION, context, reqCache)
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
