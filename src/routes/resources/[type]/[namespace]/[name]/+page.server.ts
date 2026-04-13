import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllResourceTypes, getResourceInfo } from '$lib/config/resources';
import { getFluxResourceDetail } from '$lib/server/flux/services.js';
import { requireClusterContext, requireScopedPermission } from '$lib/server/http/guards.js';

function isHttpErrorLike(error: unknown): error is {
	body?: { error?: string; message?: string };
	status: number;
} {
	return (
		typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		typeof (error as { status: unknown }).status === 'number'
	);
}

export const load: PageServerLoad = async ({ params, locals, depends }) => {
	const { type, namespace, name } = params;
	depends(`flux:resource:${type}:${namespace}:${name}`);

	// Validate resource type
	const validTypes = getAllResourceTypes();
	if (!validTypes.includes(type)) {
		error(404, {
			message: `Unknown resource type: ${type}`
		});
	}

	const resourceInfo = getResourceInfo(type);
	if (!resourceInfo) {
		error(404, {
			message: `Resource info not found for: ${type}`
		});
	}

	try {
		requireClusterContext(locals);
		await requireScopedPermission(locals, 'read', resourceInfo.kind, namespace);
		const { resource } = await getFluxResourceDetail({
			locals,
			name,
			namespace,
			resourceType: type,
			statusOnly: false
		});

		return {
			resourceType: type,
			resourceInfo,
			namespace,
			name,
			resource
		};
	} catch (err) {
		if (isHttpErrorLike(err)) {
			if (err.status === 404) {
				error(404, {
					message: `Resource not found: ${namespace}/${name}`
				});
			}

			error(err.status, {
				message: err.body?.message || err.body?.error || `Failed to fetch resource: ${err.status}`
			});
		}

		error(500, {
			message: 'Failed to connect to the API'
		});
	}
};
