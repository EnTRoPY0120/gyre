import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
	listUsers,
	listUsersPaginated,
	createUser,
	updateUser,
	deleteUser,
	updateUserPassword
} from '$lib/server/auth';
import { isAdmin } from '$lib/server/rbac';
import { logUserManagement } from '$lib/server/audit';

/**
 * Load function for user management page
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	// Get pagination and search params from URL
	const search = url.searchParams.get('search') || '';
	const limit = parseInt(url.searchParams.get('limit') || '10');
	const offset = parseInt(url.searchParams.get('offset') || '0');

	// Load paginated users
	const { users, total } = await listUsersPaginated({ search, limit, offset });

	return {
		users: users.map((u) => ({
			id: u.id,
			username: u.username,
			email: u.email,
			role: u.role,
			active: u.active,
			isLocal: u.isLocal,
			createdAt: u.createdAt,
			updatedAt: u.updatedAt
		})),
		total,
		search,
		limit,
		offset,
		currentUser: locals.user!
	};
};

export const actions: Actions = {
	/**
	 * Create a new user
	 */
	create: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const username = formData.get('username') as string;
		const email = formData.get('email') as string;
		const role = formData.get('role') as 'admin' | 'editor' | 'viewer';
		const password = formData.get('password') as string;

		// Validation
		if (!username || !password || !role) {
			return fail(400, { error: 'Username, password, and role are required' });
		}

		if (username.length < 3) {
			return fail(400, { error: 'Username must be at least 3 characters' });
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters' });
		}

		try {
			const newUser = await createUser(username, password, role, email || undefined);

			await logUserManagement(locals.user, 'create', newUser.id, newUser.username, { role, email });

			return { success: true, user: newUser };
		} catch (error) {
			console.error('Error creating user:', error);
			if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
				return fail(400, { error: 'Username already exists' });
			}
			return fail(500, { error: 'Failed to create user' });
		}
	},

	/**
	 * Update an existing user
	 */
	update: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const email = formData.get('email') as string;
		const role = formData.get('role') as 'admin' | 'editor' | 'viewer' | null;
		const active = formData.get('active') as string;

		if (!userId) {
			return fail(400, { error: 'User ID is required' });
		}

		// Prevent self-demotion from admin
		if (userId === locals.user.id && role && role !== 'admin') {
			return fail(400, { error: 'Cannot remove your own admin role' });
		}

		// Prevent self-deactivation
		if (userId === locals.user.id && active === 'false') {
			return fail(400, { error: 'Cannot deactivate your own account' });
		}

		try {
			const updates: Parameters<typeof updateUser>[1] = {};
			if (email) updates.email = email;
			if (role) updates.role = role;
			if (active !== null) updates.active = active === 'true';

			const updatedUser = await updateUser(userId, updates);

			if (updatedUser) {
				await logUserManagement(locals.user, 'update', userId, updatedUser.username, updates);
			}

			return { success: true };
		} catch (error) {
			console.error('Error updating user:', error);
			return fail(500, { error: 'Failed to update user' });
		}
	},

	/**
	 * Delete a user
	 */
	delete: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const username = formData.get('username') as string;

		if (!userId) {
			return fail(400, { error: 'User ID is required' });
		}

		// Prevent self-deletion
		if (userId === locals.user.id) {
			return fail(400, { error: 'Cannot delete your own account' });
		}

		try {
			await deleteUser(userId);

			await logUserManagement(locals.user, 'delete', userId, username || 'unknown', {});

			return { success: true };
		} catch (error) {
			console.error('Error deleting user:', error);
			return fail(500, { error: 'Failed to delete user' });
		}
	},

	/**
	 * Reset user password
	 * Only works for local users (not SSO users)
	 */
	resetPassword: async ({ request, locals }) => {
		if (!locals.user || !isAdmin(locals.user)) {
			return fail(403, { error: 'Forbidden' });
		}

		const formData = await request.formData();
		const userId = formData.get('userId') as string;
		const newPassword = formData.get('newPassword') as string;

		if (!userId || !newPassword) {
			return fail(400, { error: 'User ID and new password are required' });
		}

		if (newPassword.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters' });
		}

		// Check if user is SSO user
		const users = await listUsers();
		const targetUser = users.find((u) => u.id === userId);
		if (targetUser && targetUser.isLocal === false) {
			return fail(400, { error: 'Cannot reset password for SSO users' });
		}

		try {
			await updateUserPassword(userId, newPassword);

			await logUserManagement(locals.user, 'update', userId, 'password-reset', {
				passwordReset: true
			});

			return { success: true, password: newPassword };
		} catch (error) {
			console.error('Error resetting password:', error);
			return fail(500, { error: 'Failed to reset password' });
		}
	}
};
