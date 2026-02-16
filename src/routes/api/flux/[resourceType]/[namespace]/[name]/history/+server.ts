import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getReconciliationHistory } from '$lib/server/kubernetes/flux/reconciliation-tracker';
import { getResourceTypeByPlural } from '$lib/server/kubernetes/flux/resources';
import { checkPermission } from '$lib/server/rbac';
import { handleApiError } from '$lib/server/kubernetes/errors.js';

export const GET: RequestHandler = async ({ params, locals, url }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const { resourceType, namespace, name } = params;
	const resolvedType = getResourceTypeByPlural(resourceType);

	if (!resolvedType) {
		throw error(400, { message: `Invalid resource type: ${resourceType}` });
	}

	// Check permission
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

	// Parse query parameters
	const limit = parseInt(url.searchParams.get('limit') || '100');
	const statusFilter = url.searchParams.get('status') as 'success' | 'failure' | 'unknown' | null;
	const sinceParam = url.searchParams.get('since');
	const since = sinceParam ? new Date(sinceParam) : undefined;

	try {
		const timeline = await getReconciliationHistory(resolvedType, namespace, name, locals.cluster, {
			limit,
			status: statusFilter || undefined,
			since
		});

		return json({
			timeline,
			total: timeline.length
		});
	} catch (err: unknown) {
		handleApiError(err, `Failed to fetch history for ${name}`);
	}
};
