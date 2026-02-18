import { json, error } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/auth';

export const metadata = {
	POST: {
		summary: 'Logout user and clear session',
		description: 'Delete the current session and clear the session cookie.',
		tags: ['Auth'],
		responses: {
			200: {
				description: 'Successful logout',
				content: {
					'application/json': {
						schema: z.object({
							success: z.boolean()
						})
					}
				}
			}
		}
	}
};

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
