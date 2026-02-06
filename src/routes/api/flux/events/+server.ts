import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllRecentEvents } from '$lib/server/kubernetes/events';
import { checkPermission } from '$lib/server/rbac.js';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	// Check permission
	const hasPermission = await checkPermission(
		locals.user,
		'read',
		undefined,
		undefined,
		locals.cluster
	);
	if (!hasPermission) {
		throw error(403, { message: 'Permission denied' });
	}

	const limit = Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10) || 20);

	try {
		const events = await getAllRecentEvents(limit, locals.cluster);
		return json({ events });
	} catch (err) {
		console.error('Failed to fetch global events:', err);
		throw error(500, { message: 'Failed to fetch events' });
	}
};
