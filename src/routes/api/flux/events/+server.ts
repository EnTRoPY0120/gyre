import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllRecentEvents } from '$lib/server/kubernetes/events';

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		throw error(401, { message: 'Authentication required' });
	}

	const limit = parseInt(url.searchParams.get('limit') || '20');

	try {
		const events = await getAllRecentEvents(limit, locals.cluster);
		return json({ events });
	} catch (err) {
		console.error('Failed to fetch global events:', err);
		throw error(500, { message: 'Failed to fetch events' });
	}
};
