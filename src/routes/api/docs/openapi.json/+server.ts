import { json, error } from '@sveltejs/kit';
import { generateOpenApiSpec, createRegistry } from '$lib/server/openapi';
import { registerApiRoutes } from '$lib/server/openapi-route';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/server/rbac';

// Import all API routes to register their metadata
// Use eager: true to ensure they are loaded
const apiRoutes = import.meta.glob('/src/routes/api/**/+server.ts', { eager: true });

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	await requirePermission(locals.user, 'read');

	const registry = createRegistry();
	registerApiRoutes(registry, apiRoutes);

	return json(generateOpenApiSpec(registry));
};
