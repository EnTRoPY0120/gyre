/**
 * SSO User Auto-Provisioning
 * Handles automatic user creation and role mapping from SSO providers.
 */

import { getDb } from '$lib/server/db';
import { accounts, type AuthProvider, type User } from '$lib/server/db/schema';
import type { OAuthTokens, OAuthUserInfo } from './oauth/types';
import { eq, and } from 'drizzle-orm';
import { getAuthSettings } from '../settings.js';
import { extractEmail, extractUsername } from './sso-claims.js';
import { provisionNewSSOUser } from './sso-provisioning.js';
import { updateLinkedSSOUser } from './sso-linked-user.js';

/**
 * SSO User Creation Result
 */
export interface SSOUserResult {
	user: User | null;
	accountLinked?: boolean;
	reason?:
		| 'signup_disabled'
		| 'domain_not_allowed'
		| 'auto_provision_disabled'
		| 'user_not_found'
		| 'user_disabled';
}

/**
 * Create or update a user from SSO login.
 * If the user already exists (linked via a Better Auth account), update last login.
 * If the user doesn't exist and auto-provisioning is enabled, create new user.
 *
 * @param providerId - Auth provider ID
 * @param userInfo - User information from IdP
 * @param providerConfig - Provider configuration
 * @returns User object or null if auto-provisioning disabled, with optional reason
 */
export async function createOrUpdateSSOUser(
	providerId: string,
	userInfo: OAuthUserInfo,
	providerConfig: AuthProvider,
	tokens?: OAuthTokens
): Promise<SSOUserResult> {
	const db = await getDb();

	// Check if user already exists via Better Auth account link
	const existingLink = await db.query.accounts.findFirst({
		where: and(eq(accounts.providerId, providerId), eq(accounts.accountId, userInfo.sub))
	});

	if (existingLink) {
		return updateLinkedSSOUser(db, existingLink.userId, userInfo, providerConfig);
	}

	// User doesn't exist - check auth settings and provider config
	const authSettings = await getAuthSettings();
	return provisionNewSSOUser({
		db,
		providerId,
		userInfo,
		providerConfig,
		tokens,
		authSettings,
		claims: { extractEmail, extractUsername }
	});
}
