import { fail } from '@sveltejs/kit';
import { logger } from '$lib/server/logger.js';
import { createUser } from '$lib/server/auth';
import { logUserManagement } from '$lib/server/audit';
import type { User } from '$lib/server/db/schema';

export interface UserCreateInput {
	username: string;
	email: string;
	role: 'admin' | 'editor' | 'viewer';
	password: string;
}

type CreateUserDependencies = {
	createUser: typeof createUser;
	logUserManagement: typeof logUserManagement;
};

const defaultDependencies: CreateUserDependencies = { createUser, logUserManagement };

export async function createUserAndLog(
	user: User,
	input: UserCreateInput,
	dependencies: CreateUserDependencies = defaultDependencies
) {
	try {
		const newUser = await dependencies.createUser(
			input.username,
			input.password,
			input.role,
			input.email || undefined
		);

		await dependencies.logUserManagement(user, 'create', newUser.id, newUser.username, {
			role: input.role,
			email: input.email
		});

		return { success: true, user: newUser };
	} catch (error) {
		logger.error(error, 'Error creating user:');
		if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
			return fail(400, { error: 'Failed to create user' });
		}
		return fail(500, { error: 'Failed to create user' });
	}
}
