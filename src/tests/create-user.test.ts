import { describe, expect, test, vi } from 'vitest';
import { createUserAndLog, type UserCreateInput } from '../routes/admin/users/create-user.js';
import type { User } from '../lib/server/db/schema.js';

const actor = { id: 'admin-1' } as User;
const input: UserCreateInput = {
	username: 'new-user',
	email: 'new@example.com',
	role: 'editor',
	password: 'StrongPassword!1'
};
const createdUser = { id: 'user-1', username: 'new-user' } as User;

describe('create user action', () => {
	test('creates the user and records the audit event', async () => {
		const createUser = vi.fn().mockResolvedValue(createdUser);
		const logUserManagement = vi.fn().mockResolvedValue(undefined);

		await expect(
			createUserAndLog(actor, input, { createUser, logUserManagement })
		).resolves.toEqual({
			success: true,
			user: createdUser
		});
		expect(createUser).toHaveBeenCalledWith(
			'new-user',
			'StrongPassword!1',
			'editor',
			'new@example.com'
		);
		expect(logUserManagement).toHaveBeenCalledWith(actor, 'create', 'user-1', 'new-user', {
			role: 'editor',
			email: 'new@example.com'
		});
	});

	test('returns a client error for duplicate usernames', async () => {
		const result = await createUserAndLog(actor, input, {
			createUser: vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: users.username')),
			logUserManagement: vi.fn()
		});

		expect(result).toMatchObject({ status: 400, data: { error: 'Failed to create user' } });
	});

	test('returns a server error for unexpected failures', async () => {
		const result = await createUserAndLog(actor, input, {
			createUser: vi.fn().mockRejectedValue(new Error('database unavailable')),
			logUserManagement: vi.fn()
		});

		expect(result).toMatchObject({ status: 500, data: { error: 'Failed to create user' } });
	});
});
