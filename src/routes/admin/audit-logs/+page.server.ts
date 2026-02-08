import type { PageServerLoad } from './$types';
import { getRecentAuditLogs } from '$lib/server/audit';

/**
 * Load function for audit logs page
 */
export const load: PageServerLoad = async ({ url }) => {
	// Validate limit parameter
	const rawLimit = url.searchParams.get('limit');
	let limit = 100;

	if (rawLimit) {
		const parsedLimit = parseInt(rawLimit, 10);
		if (!Number.isNaN(parsedLimit) && Number.isFinite(parsedLimit)) {
			// Clamp between 1 and 1000
			limit = Math.max(1, Math.min(1000, parsedLimit));
		}
	}

	const action = url.searchParams.get('action') || undefined;
	const userId = url.searchParams.get('userId') || undefined;

	const logs = await getRecentAuditLogs(userId, action, limit);

	return {
		logs: logs.map((log) => {
			let details = null;
			if (log.details) {
				try {
					details = JSON.parse(log.details);
				} catch (e) {
					console.warn(`Failed to parse audit log details for ID ${log.id}:`, e);
					details = { raw: log.details, error: 'Failed to parse JSON' };
				}
			}

			return {
				...log,
				details
			};
		})
	};
};
