import { logger } from '$lib/server/logger.js';
import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import { checkRateLimit } from '$lib/server/rate-limiter';
import { executePasswordChange } from './flow';
import { validatePasswordChangeInput } from './validation';

export const _metadata = {
	POST: {
		summary: 'Change user password',
		description:
			"Change the authenticated user's password. Requires current password and validates new password strength (min 8 chars, uppercase, lowercase, number, special character).",
		tags: ['Auth'],
		request: {
			body: {
				content: {
					'application/json': {
						schema: z.object({
							currentPassword: z.string().min(1).openapi({ example: 'OldPassword123!' }),
							newPassword: z
								.string()
								.min(8)
								.regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>])/, {
									message:
										'Password must include uppercase, lowercase, number and special character'
								})
								.openapi({
									example: 'NewPassword123!',
									description:
										'Must be at least 8 characters and include uppercase, lowercase, a number, and a special character (e.g., !@#$%^&*)'
								})
						})
					}
				}
			}
		},
		responses: {
			200: {
				description: 'Password changed successfully',
				content: {
					'application/json': {
						schema: z.object({
							success: z.boolean(),
							message: z.string()
						})
					}
				}
			},
			400: {
				description: 'Validation error (missing fields, weak password, same as current)',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			},
			401: {
				description: 'Authentication required or current password incorrect',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			},
			500: {
				description: 'Internal server error',
				content: { 'application/json': { schema: z.object({ message: z.string() }) } }
			}
		}
	}
};

/**
 * POST /api/auth/change-password
 * Change user's password (requires authentication)
 */
export const POST: RequestHandler = async ({ request, locals, setHeaders, cookies }) => {
	try {
		// Require authentication
		if (!locals.user) {
			throw error(401, { message: 'Authentication required' });
		}

		checkRateLimit({ setHeaders }, `change-password:${locals.user.id}`, 5, 15 * 60 * 1000);

		const body = await request.json();
		const { currentPassword, newPassword } = body;

		// Validate inputs
		const inputError = validatePasswordChangeInput(currentPassword, newPassword);
		if (inputError) throw error(400, { message: inputError });

		if (locals.user.isLocal === false) {
			throw error(403, {
				message: 'This account is managed via SSO and has no local password.'
			});
		}

		await executePasswordChange({
			user: locals.user,
			request,
			cookies,
			currentPassword,
			newPassword,
			ipAddress: locals.session?.ipAddress || undefined
		});

		return json({
			success: true,
			message: 'Password changed successfully'
		});
	} catch (err) {
		if (isHttpError(err) || isRedirect(err)) {
			throw err;
		}
		logger.error(err, 'Change password error:');
		throw error(500, { message: 'Internal server error' });
	}
};
