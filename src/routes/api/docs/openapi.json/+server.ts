import { json, error } from '@sveltejs/kit';
import { generateOpenApiSpec, createRegistry } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/server/rbac';

// Import all API routes to register their metadata
// Use eager: true to ensure they are loaded
const apiRoutes = import.meta.glob('/src/routes/api/**/+server.ts', { eager: true });

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		throw error(401, 'Authentication required');
	}

	if (!locals.cluster) {
		throw error(400, 'Missing cluster context');
	}

	await requirePermission(locals.user, 'read', undefined, undefined, locals.cluster);

	const registry = createRegistry();

	for (const [path, module] of Object.entries(apiRoutes)) {
		const metadata = (module as any).metadata;
		if (!metadata) continue;

		// Convert file path to API path
		// Example: /src/routes/api/auth/login/+server.ts -> /api/auth/login
		// Example: /src/routes/api/flux/[resourceType]/+server.ts -> /api/flux/{resourceType}
		let apiPath = path
			.replace('/src/routes', '')
			.replace('/+server.ts', '')
			.replace(/\[(\w+)\]/g, '{$1}'); // Convert [param] to {param}

		// Register each method defined in metadata
		for (const [method, config] of Object.entries(metadata)) {
			registry.registerPath({
				method: method.toLowerCase() as any,
				path: apiPath,
				...(config as any)
			});
		}
	}

	return json(generateOpenApiSpec(registry));
};
