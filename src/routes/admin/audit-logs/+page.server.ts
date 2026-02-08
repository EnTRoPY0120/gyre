import type { PageServerLoad } from './$types';
import { getRecentAuditLogs } from '$lib/server/audit';

/**
 * Load function for audit logs page
 */
export const load: PageServerLoad = async ({ url }) => {
	const limit = parseInt(url.searchParams.get('limit') || '100');
	const action = url.searchParams.get('action') || undefined;
	const userId = url.searchParams.get('userId') || undefined;

	const logs = await getRecentAuditLogs(userId, action, limit);

	return {
		logs: logs.map((log) => ({
			...log,
			// Convert details from string to object if it exists
			details: log.details ? JSON.parse(log.details) : null
		}))
	};
};
