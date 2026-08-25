import { logger } from '$lib/server/logger.js';
import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { listUsersPaginated, updateUser, deleteUser } from '$lib/server/auth';
import { logUserManagement } from '$lib/server/audit';
import { createUserAndLog, type UserCreateInput } from './create-user';
import { resetPasswordAction } from './reset-password';
import { parseAdminPagination } from '../pagination';
import {
	getRequiredFormString,
	requireAdminFormUser,
	serializePagination
} from '../server-helpers';
import { validateUserCreateInput, validateUserUpdateInput } from './action-validation';
import type { User } from '$lib/server/db/schema';

function readUserCreateInput(formData: FormData): UserCreateInput {
	return {
		username: formData.get('username') as string,
		email: formData.get('email') as string,
		role: formData.get('role') as UserCreateInput['role'],
		password: formData.get('password') as string
	};
}

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

async function updateUserAndLog(
	user: User,
	userId: string,
	updates: Parameters<typeof updateUser>[1]
) {
	try {
		const updatedUser = await updateUser(userId, updates);

		if (updatedUser) {
			await logUserManagement(user, 'update', userId, updatedUser.username, updates);
		}

		return { success: true };
	} catch (error) {
		logger.error(error, 'Error updating user:');
		return fail(500, { error: 'Failed to update user' });
	}
}

async function deleteUserAndLog(user: User, userId: string, username: string) {
	try {
		await deleteUser(userId);
		await logUserManagement(user, 'delete', userId, username || 'unknown', {});
		return { success: true };
	} catch (error) {
		logger.error(error, 'Error deleting user:');
		return fail(500, { error: 'Failed to delete user' });
	}
}

export const actions: Actions = {
	/**
	 * Create a new user
	 */
	create: async ({ request, locals }) => {
		const user = requireAdminFormUser(locals);
		if ('status' in user) return user;

		const input = readUserCreateInput(await request.formData());

		const validationError = validateUserCreateInput(
			input.username,
			input.email,
			input.password,
			input.role
		);
		if (validationError) return fail(400, { error: validationError });

		return createUserAndLog(user, input);
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

		return updateUserAndLog(user, userId, buildUserUpdates(email, role, active));
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

		return deleteUserAndLog(user, userId, username);
	},

	/**
	 * Reset user password
	 * Only works for local users (not SSO users)
	 */
	resetPassword: resetPasswordAction
};
