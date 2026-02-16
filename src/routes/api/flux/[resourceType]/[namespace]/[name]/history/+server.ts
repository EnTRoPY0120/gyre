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

	// Parse and validate query parameters
	const limitParam = url.searchParams.get('limit');
	const parsedLimit = limitParam ? parseInt(limitParam, 10) : 100;
	const limit = Number.isNaN(parsedLimit) ? 100 : Math.min(Math.max(parsedLimit, 1), 1000);

	const statusParam = url.searchParams.get('status');
	const allowedStatuses = ['success', 'failure', 'unknown'];
	const statusFilter =
		statusParam && allowedStatuses.includes(statusParam)
			? (statusParam as 'success' | 'failure' | 'unknown')
			: null;

	const sinceParam = url.searchParams.get('since');
	let since: Date | undefined;
	if (sinceParam) {
		const sinceDate = new Date(sinceParam);
		since = Number.isNaN(sinceDate.getTime()) ? undefined : sinceDate;
	}

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
