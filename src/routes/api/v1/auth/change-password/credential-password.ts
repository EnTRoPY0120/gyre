import { error } from '@sveltejs/kit';
import type { User } from '$lib/server/db/schema.js';
import { logger } from '$lib/server/logger.js';
import {
	getCredentialAccount,
	getCredentialPasswordHash,
	isInClusterAdmin
} from '$lib/server/auth';

/**
 * Resolve the local credential hash used by the password-change flow.
 *
 * A missing account is a data-integrity failure. The in-cluster admin is
 * intentionally hashless because Kubernetes owns that password. All other
 * missing hashes are also configuration failures and must not reach bcrypt.
 */
export async function requireCredentialPasswordHash(user: User): Promise<string> {
	const credentialAccount = await getCredentialAccount(user.id);
	const currentCredentialHash = await getCredentialPasswordHash(user.id);
	if (currentCredentialHash) return currentCredentialHash;

	if (!credentialAccount) {
		logger.error({ userId: user.id }, '[Auth] Local user is missing a credential account');
		throw error(500, {
			message:
				'Account configuration error: credential account missing for this user. Contact your administrator.'
		});
	}

	if (isInClusterAdmin(user)) {
		throw error(403, {
			message:
				'The in-cluster admin password is managed via the Kubernetes secret "gyre-initial-admin-secret". Update the secret to rotate the password.'
		});
	}

	logger.error(
		{ userId: user.id, credentialAccountId: credentialAccount.id },
		'[Auth] Local user credential account has no password hash'
	);
	throw error(500, {
		message:
			'Account configuration error: credential password hash missing for this user. Contact your administrator.'
	});
}
