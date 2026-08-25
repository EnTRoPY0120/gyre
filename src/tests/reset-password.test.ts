import { describe, expect, test, vi } from 'vitest';
import {
	resetPasswordAction,
	type ResetPasswordDependencies
} from '../routes/admin/users/reset-password.js';
import type { User } from '../lib/server/db/schema.js';

const admin = { id: 'admin-1', role: 'admin' } as User;

function makeEvent(userId = 'target-1', newPassword = 'StrongPassword!1') {
	const formData = new FormData();
	formData.set('userId', userId);
	formData.set('newPassword', newPassword);

	return {
		locals: { user: admin },
		request: { formData: async () => formData }
	} as never;
}

function makeDependencies(
	overrides: Partial<ResetPasswordDependencies> = {}
): ResetPasswordDependencies {
	return {
		requireAdminFormUser: vi.fn(() => admin),
		tryCheckRateLimit: vi.fn(() => ({ limited: false, retryAfter: 0 })),
		getUserById: vi.fn().mockResolvedValue({ id: 'target-1', isLocal: true }),
		hasManagedPassword: vi.fn().mockResolvedValue(true),
		updateUserPassword: vi.fn().mockResolvedValue(undefined),
		logUserManagement: vi.fn().mockResolvedValue(undefined),
		validatePasswordResetInput: vi.fn(() => null),
		logger: { error: vi.fn() },
		...overrides
	};
}

describe('resetPasswordAction', () => {
	test('updates a local user password and records the audit event', async () => {
		const dependencies = makeDependencies();

		await expect(resetPasswordAction(makeEvent(), dependencies)).resolves.toEqual({
			success: true
		});
		expect(dependencies.tryCheckRateLimit).toHaveBeenCalledWith(
			expect.anything(),
			'admin-reset:admin-1',
			10,
			15 * 60 * 1000
		);
		expect(dependencies.updateUserPassword).toHaveBeenCalledWith('target-1', 'StrongPassword!1');
		expect(dependencies.logUserManagement).toHaveBeenCalledWith(
			admin,
			'update',
			'target-1',
			'password-reset',
			{ passwordReset: true }
		);
	});

	test('rejects rate-limited requests before reading the form', async () => {
		const formData = vi.fn();
		const dependencies = makeDependencies({
			tryCheckRateLimit: vi.fn(() => ({ limited: true, retryAfter: 42 }))
		});
		const event = { locals: { user: admin }, request: { formData } } as never;

		const result = await resetPasswordAction(event, dependencies);

		expect(result).toMatchObject({
			status: 429,
			data: { error: 'Too many password reset attempts. Try again in 42 seconds.' }
		});
		expect(formData).not.toHaveBeenCalled();
	});

	test('returns validation failures without querying the target user', async () => {
		const dependencies = makeDependencies({
			validatePasswordResetInput: vi.fn(() => 'Password does not meet strength requirements')
		});

		const result = await resetPasswordAction(makeEvent(), dependencies);

		expect(result).toMatchObject({
			status: 400,
			data: { error: 'Password does not meet strength requirements' }
		});
		expect(dependencies.getUserById).not.toHaveBeenCalled();
	});

	test.each([
		['SSO users', { id: 'target-1', isLocal: false }, true, 'Cannot reset password for SSO users'],
		[
			'in-cluster admins',
			{ id: 'target-1', isLocal: true },
			false,
			'The in-cluster admin password is managed via the Kubernetes secret and cannot be reset here'
		]
	])('rejects password resets for %s', async (_label, target, managed, message) => {
		const dependencies = makeDependencies({
			getUserById: vi.fn().mockResolvedValue(target),
			hasManagedPassword: vi.fn().mockResolvedValue(managed)
		});

		const result = await resetPasswordAction(makeEvent(), dependencies);

		expect(result).toMatchObject({ status: 400, data: { error: message } });
		expect(dependencies.updateUserPassword).not.toHaveBeenCalled();
	});

	test('returns a server failure when password persistence fails', async () => {
		const error = new Error('database unavailable');
		const dependencies = makeDependencies({
			updateUserPassword: vi.fn().mockRejectedValue(error)
		});

		const result = await resetPasswordAction(makeEvent(), dependencies);

		expect(result).toMatchObject({ status: 500, data: { error: 'Failed to reset password' } });
		expect(dependencies.logger.error).toHaveBeenCalledWith(error, 'Error resetting password:');
	});
});
