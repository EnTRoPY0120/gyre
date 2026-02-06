import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/auth';

/**
 * POST /api/auth/logout
 * Logout user and clear session
 */
export const POST: RequestHandler = async ({ cookies }) => {
	try {
		const sessionId = cookies.get('gyre_session');

		if (sessionId) {
			// Delete session from database
			await deleteSession(sessionId);

			// Clear cookie
			cookies.delete('gyre_session', { path: '/' });
		}

		return json({ success: true });
	} catch (err) {
		console.error('Logout error:', err);
		throw error(500, { message: 'Internal server error' });
	}
};
