import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getResourceEvents } from '$lib/server/kubernetes/events';
import { getResourceTypeByPlural, FLUX_RESOURCES } from '$lib/server/kubernetes/flux/resources';
import type { FluxResourceType } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac.js';

export const GET: RequestHandler = async ({ params, locals }) => {
	// Check authentication
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;

	// Resolve the resource type from plural name
	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);

	if (!resolvedType) {
		throw error(400, `Invalid resource type: ${resourceType}`);
	}

	// Check permission for read action
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		resolvedType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	// Get the resource kind from FLUX_RESOURCES
	const resourceDef = FLUX_RESOURCES[resolvedType];
	const resourceKind = resourceDef.kind;

	try {
		const events = await getResourceEvents(namespace, name, resourceKind, locals.cluster);
		return json({ events });
	} catch (err) {
		console.error(`Failed to fetch events for ${resourceType}/${namespace}/${name}:`, err);
		throw error(
			500,
			`Failed to fetch events: ${err instanceof Error ? err.message : 'Unknown error'}`
		);
	}
};
