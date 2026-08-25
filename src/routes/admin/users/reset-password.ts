import { fail, type RequestEvent } from '@sveltejs/kit';
import { logger } from '$lib/server/logger.js';
import { getUserById, hasManagedPassword, updateUserPassword } from '$lib/server/auth';
import { logUserManagement } from '$lib/server/audit';
import { tryCheckRateLimit } from '$lib/server/rate-limiter';
import { requireAdminFormUser } from '../server-helpers';
import { validatePasswordResetInput } from './action-validation';
import type { User } from '$lib/server/db/schema';

export interface ResetPasswordDependencies {
	requireAdminFormUser: typeof requireAdminFormUser;
	tryCheckRateLimit: typeof tryCheckRateLimit;
	getUserById: typeof getUserById;
	hasManagedPassword: typeof hasManagedPassword;
	updateUserPassword: typeof updateUserPassword;
	logUserManagement: typeof logUserManagement;
	validatePasswordResetInput: typeof validatePasswordResetInput;
	logger: Pick<typeof logger, 'error'>;
}

const defaultDependencies: ResetPasswordDependencies = {
	requireAdminFormUser,
	tryCheckRateLimit,
	getUserById,
	hasManagedPassword,
	updateUserPassword,
	logUserManagement,
	validatePasswordResetInput,
	logger
};

async function getPasswordResetError(
	userId: string,
	dependencies: ResetPasswordDependencies
): Promise<string | null> {
	const targetUser = await dependencies.getUserById(userId);
	if (targetUser && targetUser.isLocal === false) {
		return 'Cannot reset password for SSO users';
	}
	if (targetUser && !(await dependencies.hasManagedPassword(targetUser.id))) {
		return 'The in-cluster admin password is managed via the Kubernetes secret and cannot be reset here';
	}
	return null;
}

async function resetUserPasswordAndLog(
	user: User,
	userId: string,
	newPassword: string,
	dependencies: ResetPasswordDependencies
) {
	try {
		await dependencies.updateUserPassword(userId, newPassword);
		await dependencies.logUserManagement(user, 'update', userId, 'password-reset', {
			passwordReset: true
		});
		return { success: true };
	} catch (error) {
		dependencies.logger.error(error, 'Error resetting password:');
		return fail(500, { error: 'Failed to reset password' });
	}
}

export async function resetPasswordAction(
	event: RequestEvent,
	dependencies: ResetPasswordDependencies = defaultDependencies
) {
	const { request, locals } = event;
	const user = dependencies.requireAdminFormUser(locals);
	if ('status' in user) return user;

	const rateLimit = dependencies.tryCheckRateLimit(
		event,
		`admin-reset:${user.id}`,
		10,
		15 * 60 * 1000
	);
	if (rateLimit.limited) {
		return fail(429, {
			error: `Too many password reset attempts. Try again in ${rateLimit.retryAfter} seconds.`
		});
	}

	const formData = await request.formData();
	const userId = formData.get('userId') as string;
	const newPassword = formData.get('newPassword') as string;

	const validationError = dependencies.validatePasswordResetInput(userId, newPassword);
	if (validationError) return fail(400, { error: validationError });

	const targetError = await getPasswordResetError(userId, dependencies);
	if (targetError) return fail(400, { error: targetError });

	return resetUserPasswordAndLog(user, userId, newPassword, dependencies);
}
