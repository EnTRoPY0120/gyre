import type { Cookies } from '@sveltejs/kit';
import type { User } from '$lib/server/db/schema.js';
import {
	addPasswordHistory,
	clearRequiresPasswordChange,
	isPasswordInHistory,
	verifyPassword
} from '$lib/server/auth';
import { applyBetterAuthCookies, getBetterAuth } from '$lib/server/auth/better-auth';
import { logAudit } from '$lib/server/audit';
import { assertPasswordStrength } from '$lib/server/auth/password-validation.js';
import { requireCredentialPasswordHash } from './credential-password';
import { error } from '@sveltejs/kit';

async function ensureCurrentPasswordValid(
	user: User,
	currentPassword: string,
	currentCredentialHash: string,
	ipAddress?: string
): Promise<void> {
	const isCurrentValid = await verifyPassword(currentPassword, currentCredentialHash);
	if (isCurrentValid) return;

	await logAudit(user, 'password_change_failed', {
		success: false,
		ipAddress,
		details: { reason: 'invalid_current_password' }
	});
	throw error(401, { message: 'Current password is incorrect' });
}

async function ensurePasswordIsNotReused(
	user: User,
	newPassword: string,
	currentCredentialHash: string,
	ipAddress?: string
): Promise<void> {
	const isSamePassword = await verifyPassword(newPassword, currentCredentialHash);
	if (isSamePassword) {
		throw error(400, { message: 'New password must be different from current password' });
	}

	const isReused = await isPasswordInHistory(user.id, newPassword);
	if (!isReused) return;

	await logAudit(user, 'password_change_failed', {
		success: false,
		ipAddress,
		details: { reason: 'password_reuse_attempt' }
	});
	throw error(400, {
		message: 'New password cannot be the same as a recently used password'
	});
}

export interface ChangePasswordFlowInput {
	user: User;
	request: Request;
	cookies: Cookies;
	currentPassword: string;
	newPassword: string;
	ipAddress?: string;
}

/**
 * Run the password rotation sequence after the route has validated its HTTP input.
 * The order is security-sensitive: retain the old hash before rotating it, then
 * record success and clear the first-login flag only after Better Auth succeeds.
 */
export async function executePasswordChange({
	user,
	request,
	cookies,
	currentPassword,
	newPassword,
	ipAddress
}: ChangePasswordFlowInput): Promise<void> {
	const currentCredentialHash = await requireCredentialPasswordHash(user);

	assertPasswordStrength(newPassword);
	await ensureCurrentPasswordValid(user, currentPassword, currentCredentialHash, ipAddress);
	await ensurePasswordIsNotReused(user, newPassword, currentCredentialHash, ipAddress);

	await addPasswordHistory(user.id, currentCredentialHash);

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

	await logAudit(user, 'password_changed', {
		success: true,
		ipAddress,
		details: { userId: user.id }
	});

	await clearRequiresPasswordChange(user.id);
}
