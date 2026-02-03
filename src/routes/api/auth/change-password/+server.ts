import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateUserPassword, verifyPassword } from '$lib/server/auth';
import { logAudit } from '$lib/server/audit';

/**
 * POST /api/auth/change-password
 * Change user's password (requires authentication)
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		// Require authentication
		if (!locals.user) {
			return error(401, { message: 'Authentication required' });
		}

		const body = await request.json();
		const { currentPassword, newPassword } = body;

		// Validate inputs
		if (!currentPassword || !newPassword) {
			return error(400, { message: 'Current password and new password are required' });
		}

		// Validate new password strength
		if (newPassword.length < 8) {
			return error(400, { message: 'Password must be at least 8 characters long' });
		}
		if (!/[A-Z]/.test(newPassword)) {
			return error(400, { message: 'Password must contain at least one uppercase letter' });
		}
		if (!/[a-z]/.test(newPassword)) {
			return error(400, { message: 'Password must contain at least one lowercase letter' });
		}
		if (!/[0-9]/.test(newPassword)) {
			return error(400, { message: 'Password must contain at least one number' });
		}

		// Verify current password
		const { user } = locals;
		const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);

		if (!isCurrentValid) {
			await logAudit(user, 'password_change_failed', {
				success: false,
				ipAddress: locals.session?.ipAddress || undefined,
				details: { reason: 'invalid_current_password' }
			});
			return error(401, { message: 'Current password is incorrect' });
		}

		// Prevent using same password
		const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
		if (isSamePassword) {
			return error(400, { message: 'New password must be different from current password' });
		}

		// Update password
		await updateUserPassword(user.id, newPassword);

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
		console.error('Change password error:', err);
		if (err instanceof Error && 'status' in err && typeof err.status === 'number') {
			throw err;
		}
		return error(500, { message: 'Internal server error' });
	}
};
