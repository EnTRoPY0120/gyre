import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFluxResources } from '$lib/server/kubernetes/client.js';
import {
	getAllResourcePlurals,
	getResourceTypeByPlural,
	type FluxResourceType
} from '$lib/server/kubernetes/flux/resources.js';
import { errorToHttpResponse } from '$lib/server/kubernetes/errors.js';
import { checkPermission } from '$lib/server/rbac.js';

/**
 * GET /api/flux/{resourceType}
 * List all resources of a specific type across all namespaces
 * Accepts both plural names (e.g., 'gitrepositories') and PascalCase (e.g., 'GitRepository')
 */
// Simple in-memory cache for API responses
const apiCache = new Map<string, { data: unknown; timestamp: number }>();
const API_CACHE_TTL = 15 * 1000; // 15 seconds

export const GET: RequestHandler = async ({ params, locals, setHeaders }) => {
	// Check authentication
	if (!locals.user) {
		return error(401, { message: 'Authentication required' });
	}

	const { resourceType } = params;

	// Try to resolve resource type from plural name first (e.g., 'gitrepositories' -> 'GitRepository')
	const resolvedType: FluxResourceType | undefined = getResourceTypeByPlural(resourceType);

	// If not found by plural, check if it's already a valid PascalCase type
	if (!resolvedType) {
		const validPlurals = getAllResourcePlurals();
		return error(400, {
			message: `Invalid resource type: ${resourceType}. Valid types: ${validPlurals.join(', ')}`
		});
	}

	// Check permission (all namespaces)
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		resolvedType,
		undefined,
		locals.cluster
	);

	if (!hasPermission) {
		return error(403, { message: 'Permission denied' });
	}

	// Create cache key
	const cacheKey = `${resolvedType}-${locals.cluster || 'default'}-${locals.user.id}`;
	const cached = apiCache.get(cacheKey);

	// Return cached data if still valid
	if (cached && Date.now() - cached.timestamp < API_CACHE_TTL) {
		setHeaders({
			'Cache-Control': 'private, max-age=15',
			'X-Cache': 'HIT'
		});
		return json(cached.data);
	}

	try {
		const resources = await listFluxResources(resolvedType, locals.cluster);

		// Store in cache
		apiCache.set(cacheKey, { data: resources, timestamp: Date.now() });

		setHeaders({
			'Cache-Control': 'private, max-age=15',
			'X-Cache': 'MISS'
		});

		return json(resources);
	} catch (err) {
		const { status, body } = errorToHttpResponse(err);
		return error(status, body.error);
	}
};
