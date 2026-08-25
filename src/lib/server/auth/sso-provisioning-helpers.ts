import type { AuthProvider, NewAccount, NewUser, User } from '$lib/server/db/schema';
import { generateUserId } from '$lib/server/auth';
import { encryptSecret } from './crypto.js';
import type { OAuthTokens, OAuthUserInfo } from './oauth/types';
import type { SSOUserResult } from './sso';

export type AuthSettings = {
	allowSignup: boolean;
	domainAllowlist: string[];
};

export function getProvisioningAccessReason(
	authSettings: AuthSettings,
	providerConfig: AuthProvider,
	email: string | undefined
): SSOUserResult['reason'] {
	if (!authSettings.allowSignup) return 'signup_disabled';
	if (!providerConfig.autoProvision) return 'auto_provision_disabled';
	if (!isAllowedDomain(email, authSettings.domainAllowlist)) return 'domain_not_allowed';
	return undefined;
}

export function isAllowedDomain(email: string | undefined, allowlist: string[]): boolean {
	if (allowlist.length === 0) return true;
	const domain = email?.split('@')[1]?.toLowerCase();
	const normalizedAllowlist = allowlist.map((entry) => entry.trim().toLowerCase());
	return Boolean(domain && normalizedAllowlist.includes(domain));
}

export function createSSOUserRecord(
	id: string,
	username: string,
	email: string | undefined,
	userInfo: OAuthUserInfo,
	role: User['role']
): NewUser {
	return {
		id,
		username,
		email: email || null,
		name: userInfo.name || username,
		image: typeof userInfo.picture === 'string' ? userInfo.picture : null,
		role,
		active: true,
		isLocal: false,
		...(userInfo.emailVerified === true ? { emailVerified: true } : {})
	};
}

export function createSSOAccountRecord(
	userId: string,
	providerId: string,
	userInfo: OAuthUserInfo,
	tokens: OAuthTokens | undefined
): NewAccount {
	return {
		id: generateUserId(),
		userId,
		providerId,
		accountId: userInfo.sub,
		accessToken: null,
		refreshToken: null,
		idToken: null,
		accessTokenExpiresAt:
			tokens?.expiresIn != null ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
		scope: tokens?.scope ?? null,
		lastLoginAt: new Date(),
		accessTokenEncrypted: tokens?.accessToken ? encryptSecret(tokens.accessToken) : null,
		refreshTokenEncrypted: tokens?.refreshToken ? encryptSecret(tokens.refreshToken) : null,
		idTokenEncrypted: tokens?.idToken ? encryptSecret(tokens.idToken) : null
	};
}
