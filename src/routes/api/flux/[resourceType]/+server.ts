import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFluxResources } from '$lib/server/kubernetes/client.js';
import {
	getAllResourcePlurals,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { errorToHttpResponse } from '$lib/server/kubernetes/errors.js';

/**
 * GET /api/flux/{resourceType}
 * List all resources of a specific type across all namespaces
 * Accepts both plural names (e.g., 'gitrepositories') and PascalCase (e.g., 'GitRepository')
 */
export const GET: RequestHandler = async ({ params }) => {
	const { resourceType } = params;

	// Try to resolve resource type from plural name first (e.g., 'gitrepositories' -> 'GitRepository')
	let resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);

	// If not found by plural, check if it's already a valid PascalCase type
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		return error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	try {
		const resources = await listFluxResources(resolvedType);
		return json(resources);
	} catch (err) {
		const { status, body } = errorToHttpResponse(err);
		return error(status, body.error);
	}
};

