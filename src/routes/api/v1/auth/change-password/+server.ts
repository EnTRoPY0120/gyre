import { logger } from '$lib/server/logger.js';
import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import {
	addPasswordHistory,
	getCredentialPasswordHash,
	hasManagedPassword,
	isPasswordInHistory,
	verifyPassword,
	verifyManagedUserPassword
} from '$lib/server/auth';
import { applyBetterAuthCookies, getBetterAuth } from '$lib/server/auth/better-auth';
import { logAudit } from '$lib/server/audit';
import { checkRateLimit } from '$lib/server/rate-limiter';

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
		if (!currentPassword || !newPassword) {
			throw error(400, { message: 'Current password and new password are required' });
		}

		if (!(await hasManagedPassword(locals.user.id))) {
			throw error(403, {
				message:
					'The in-cluster admin password is managed via the Kubernetes secret "gyre-initial-admin-secret". Update the secret to rotate the password.'
			});
		}

		// Validate new password strength
		if (newPassword.length < 8) {
			throw error(400, { message: 'New password must be at least 8 characters long.' });
		}
		if (!/[A-Z]/.test(newPassword)) {
			throw error(400, { message: 'New password must contain at least one uppercase letter.' });
		}
		if (!/[a-z]/.test(newPassword)) {
			throw error(400, { message: 'New password must contain at least one lowercase letter.' });
		}
		if (!/[0-9]/.test(newPassword)) {
			throw error(400, { message: 'New password must contain at least one number.' });
		}
		if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
			throw error(400, {
				message: 'New password must contain at least one special character (e.g., !@#$%^&*).'
			});
		}

		// Verify current password
		const { user } = locals;
		// hasManagedPassword above already confirmed the hash exists
		const currentCredentialHash = (await getCredentialPasswordHash(user.id))!;
		const isCurrentValid = await verifyManagedUserPassword(user, currentPassword);

		if (!isCurrentValid) {
			await logAudit(user, 'password_change_failed', {
				success: false,
				ipAddress: locals.session?.ipAddress || undefined,
				details: { reason: 'invalid_current_password' }
			});
			throw error(401, { message: 'Current password is incorrect' });
		}

		// Prevent using same password
		const isSamePassword = await verifyPassword(newPassword, currentCredentialHash);
		if (isSamePassword) {
			throw error(400, { message: 'New password must be different from current password' });
		}

		// Check password history
		const isReused = await isPasswordInHistory(user.id, newPassword);
		if (isReused) {
			await logAudit(user, 'password_change_failed', {
				success: false,
				ipAddress: locals.session?.ipAddress || undefined,
				details: { reason: 'password_reuse_attempt' }
			});
			throw error(400, {
				message: 'New password cannot be the same as a recently used password'
			});
		}

		// Update password through Better Auth so the credential account remains the
		// sole live password source of truth.
		const auth = getBetterAuth();
		const changePasswordResult = await auth.api.changePassword({
			headers: request.headers,
			body: {
				currentPassword,
				newPassword,
				revokeOtherSessions: false
			},
			returnHeaders: true
		});
		await addPasswordHistory(user.id, currentCredentialHash);
		applyBetterAuthCookies(cookies, changePasswordResult.headers);

		// Log successful password change
		await logAudit(user, 'password_changed', {
			success: true,
			ipAddress: locals.session?.ipAddress || undefined,
			details: { userId: user.id }
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
