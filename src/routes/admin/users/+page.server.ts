import { logger } from '$lib/server/logger.js';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
	listUsersPaginated,
	getUserById,
	hasManagedPassword,
	createUser,
	updateUser,
	deleteUser,
	updateUserPassword
} from '$lib/server/auth';
import { logUserManagement } from '$lib/server/audit';
import { tryCheckRateLimit } from '$lib/server/rate-limiter';
import { parseAdminPagination } from '../pagination';
import {
	getRequiredFormString,
	requireAdminFormUser,
	serializePagination
} from '../server-helpers';
import {
	validatePasswordResetInput,
	validateUserCreateInput,
	validateUserUpdateInput
} from './action-validation';

/**
 * Load function for user management page
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	// Get pagination and search params from URL
	const pagination = parseAdminPagination(url);

	// Load paginated users
	const page = await listUsersPaginated(pagination);

	return {
		...serializePagination(page, 'users', (u) => ({
			id: u.id,
			username: u.username,
			email: u.email,
			role: u.role,
			active: u.active,
			isLocal: u.isLocal,
			createdAt: u.createdAt,
			updatedAt: u.updatedAt
		})),
		...pagination,
		currentUser: locals.user!
	};
};

function buildUserUpdates(
	email: string,
	role: 'admin' | 'editor' | 'viewer' | null,
	active: string
): Parameters<typeof updateUser>[1] {
	const updates: Parameters<typeof updateUser>[1] = {};
	if (email) updates.email = email;
	if (role) updates.role = role;
	if (active !== null) updates.active = active === 'true';
	return updates;
}

async function getPasswordResetError(userId: string): Promise<string | null> {
	const targetUser = await getUserById(userId);
	if (targetUser && targetUser.isLocal === false) {
		return 'Cannot reset password for SSO users';
	}
	if (targetUser && !(await hasManagedPassword(targetUser.id))) {
		return 'The in-cluster admin password is managed via the Kubernetes secret and cannot be reset here';
	}
	return null;
}

export const actions: Actions = {
	/**
	 * Create a new user
	 */
	create: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const formData = await request.formData();
		const username = formData.get('username') as string;
		const email = formData.get('email') as string;
		const role = formData.get('role') as 'admin' | 'editor' | 'viewer';
		const password = formData.get('password') as string;

		const validationError = validateUserCreateInput(username, email, password, role);
		if (validationError) return fail(400, { error: validationError });

		try {
			const newUser = await createUser(username, password, role, email || undefined);

			await logUserManagement(user, 'create', newUser.id, newUser.username, { role, email });

			return { success: true, user: newUser };
		} catch (error) {
			logger.error(error, 'Error creating user:');
			if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
				return fail(400, { error: 'Failed to create user' });
			}
			return fail(500, { error: 'Failed to create user' });
		}
	},

	/**
	 * Update an existing user
	 */
	update: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const formData = await request.formData();
		const userId = getRequiredFormString(formData, 'userId', 'User ID is required');
		if (typeof userId !== 'string') return userId;
		const email = formData.get('email') as string;
		const role = formData.get('role') as 'admin' | 'editor' | 'viewer' | null;
		const active = formData.get('active') as string;

		const validationError = validateUserUpdateInput(userId, user.id, email, role, active);
		if (validationError) return fail(400, { error: validationError });

		try {
			const updates = buildUserUpdates(email, role, active);
			const updatedUser = await updateUser(userId, updates);

			if (updatedUser) {
				await logUserManagement(user, 'update', userId, updatedUser.username, updates);
			}

			return { success: true };
		} catch (error) {
			logger.error(error, 'Error updating user:');
			return fail(500, { error: 'Failed to update user' });
		}
	},

	/**
	 * Delete a user
	 */
	delete: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const formData = await request.formData();
		const userId = getRequiredFormString(formData, 'userId', 'User ID is required');
		if (typeof userId !== 'string') return userId;
		const username = formData.get('username') as string;

		// Prevent self-deletion
		if (userId === user.id) {
			return fail(400, { error: 'Cannot delete your own account' });
		}

		try {
			await deleteUser(userId);

			await logUserManagement(user, 'delete', userId, username || 'unknown', {});

			return { success: true };
		} catch (error) {
			logger.error(error, 'Error deleting user:');
			return fail(500, { error: 'Failed to delete user' });
		}
	},

	/**
	 * Reset user password
	 * Only works for local users (not SSO users)
	 */
	resetPassword: async (event) => {
		const { request, locals } = event;
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const rateLimit = tryCheckRateLimit(event, `admin-reset:${user.id}`, 10, 15 * 60 * 1000);
		if (rateLimit.limited) {
			return fail(429, {
				error: `Too many password reset attempts. Try again in ${rateLimit.retryAfter} seconds.`
			});
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const newPassword = formData.get('newPassword') as string;

		const validationError = validatePasswordResetInput(userId, newPassword);
		if (validationError) return fail(400, { error: validationError });

		const targetError = await getPasswordResetError(userId);
		if (targetError) return fail(400, { error: targetError });

		try {
			await updateUserPassword(userId, newPassword);

			await logUserManagement(user, 'update', userId, 'password-reset', {
				passwordReset: true
			});

			return { success: true };
		} catch (error) {
			logger.error(error, 'Error resetting password:');
			return fail(500, { error: 'Failed to reset password' });
		}
	}
};
