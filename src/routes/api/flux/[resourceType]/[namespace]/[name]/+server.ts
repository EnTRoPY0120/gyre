import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getFluxResource, getFluxResourceStatus } from '$lib/server/kubernetes/client.js';
import {
	getAllResourcePlurals,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { errorToHttpResponse } from '$lib/server/kubernetes/errors.js';
import { checkPermission } from '$lib/server/rbac.js';

/**
 * GET /api/flux/{resourceType}/{namespace}/{name}
 * Get a specific resource
 *
 * Query params:
 * - status=true: Get resource status instead of full object
 */
export const GET: RequestHandler = async ({ params, url, locals }) => {
	// Check authentication
	if (!locals.user) {
		return error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;
	const getStatus = url.searchParams.get('status') === 'true';

	// Resolve resource type from plural name
	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		return error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	// Check permission for specific namespace
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		resolvedType,
		namespace,
		locals.cluster
	);

	if (!hasPermission) {
		return error(403, { message: 'Permission denied' });
	}

	try {
		const resource = getStatus
			? await getFluxResourceStatus(resolvedType, namespace, name, locals.cluster)
			: await getFluxResource(resolvedType, namespace, name, locals.cluster);

		return json(resource);
	} catch (err) {
		const { status, body } = errorToHttpResponse(err);
		return error(status, body.error);
	}
};
