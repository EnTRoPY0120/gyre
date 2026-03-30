import { logger } from '$lib/server/logger.js';
import { json, error, isHttpError, isRedirect } from '@sveltejs/kit';
import { z } from '$lib/server/openapi';
import type { RequestHandler } from './$types';
import {
	addPasswordHistory,
	getCredentialAccount,
	getCredentialPasswordHash,
	isInClusterAdmin,
	isPasswordInHistory,
	verifyPassword
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

		if (locals.user.isLocal === false) {
			throw error(403, {
				message: 'This account is managed via SSO and has no local password.'
			});
		}

		// Distinguish between a missing credential row (data integrity issue) and
		// the in-cluster admin path, where getCredentialPasswordHash intentionally
		// returns null so the Kubernetes secret remains the source of truth.
		const credentialAccount = await getCredentialAccount(locals.user.id);
		const currentCredentialHash = await getCredentialPasswordHash(locals.user.id);
		if (!currentCredentialHash) {
			if (!credentialAccount) {
				logger.error(
					{ userId: locals.user.id },
					'[Auth] Local user is missing a credential account'
				);
				throw error(500, {
					message:
						'Account configuration error: credential account missing for this user. Contact your administrator.'
				});
			}

			if (isInClusterAdmin(locals.user)) {
				throw error(403, {
					message:
						'The in-cluster admin password is managed via the Kubernetes secret "gyre-initial-admin-secret". Update the secret to rotate the password.'
				});
			}
			logger.error(
				{ userId: locals.user.id, credentialAccountId: credentialAccount.id },
				'[Auth] Local user credential account has no password hash'
			);
			throw error(500, {
				message:
					'Account configuration error: credential password hash missing for this user. Contact your administrator.'
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

		// Verify current password using the hash already in hand — no second DB read.
		const { user } = locals;
		const isCurrentValid = await verifyPassword(currentPassword, currentCredentialHash);

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

		// Record current password in history BEFORE rotating. addPasswordHistory is
		// idempotent for (user.id, currentCredentialHash), so retries do not crowd
		// out real history entries before the live credential changes.
		await addPasswordHistory(user.id, currentCredentialHash);

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
