import { logger } from '$lib/server/logger.js';
import { json, error } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { deleteSession, deleteUserSessions } from '$lib/server/auth';
import { logLogout } from '$lib/server/audit';

export const _metadata = {
	POST: {
		summary: 'Logout user and clear session',
		description:
			'Delete the current session and clear the session cookie. Pass `{ "all": true }` to invalidate every session for the authenticated user.',
		tags: ['Auth'],
		request: {
			body: {
				required: false,
				content: {
					'application/json': {
						schema: z.object({
							all: z.boolean().optional().openapi({
								description: 'When true, all sessions for the user are invalidated.',
								example: true
							})
						})
					}
				}
			}
		},
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
export const POST: RequestHandler = async ({ request, cookies, locals, getClientAddress }) => {
	if (!locals.cluster) {
		throw error(400, { message: 'Missing cluster context' });
	}

	try {
		const ipAddress = getClientAddress();
		const { all } = await request.json().catch(() => ({}));

		// Use the middleware-validated session id, not the raw cookie value,
		// so an attacker-supplied cookie cannot delete an arbitrary session.
		if (locals.session) {
			await deleteSession(locals.session.id);
		}

		// Invalidate all sessions and emit audit event only when authenticated.
		if (locals.user) {
			if (all === true) {
				await deleteUserSessions(locals.user.id);
			}
			await logLogout(locals.user, ipAddress);
		}

		cookies.delete('gyre_session', { path: '/' });

		return json({ success: true });
	} catch (err) {
		logger.error(err, 'Logout error:');
		throw error(500, { message: 'Internal server error' });
	}
};
