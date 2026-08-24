import type { OAuthTokens } from './oauth';
import { encryptSecret } from './crypto';

export interface OAuthAccountData {
	userId: string;
	providerId: string;
	accountId: string;
	accessToken: null;
	refreshToken: null;
	idToken: null;
	accessTokenExpiresAt: Date | null;
	scope: string | null;
	lastLoginAt: Date;
	accessTokenEncrypted: string | null;
	refreshTokenEncrypted: string | null;
	idTokenEncrypted: string | null;
}

export type ExistingOAuthAccount = Partial<
	Pick<
		OAuthAccountData,
		| 'accessTokenExpiresAt'
		| 'scope'
		| 'accessTokenEncrypted'
		| 'refreshTokenEncrypted'
		| 'idTokenEncrypted'
	>
>;

function preserveOrEncrypt(
	token: string | undefined,
	existingValue: string | null | undefined
): string | null {
	return token ? encryptSecret(token) : (existingValue ?? null);
}

/** Build the Better Auth account payload while preserving tokens omitted by a provider. */
export function buildOAuthAccountData(
	userId: string,
	providerId: string,
	providerUserId: string,
	tokens: OAuthTokens | undefined,
	existingAccount: ExistingOAuthAccount | null | undefined,
	now = new Date()
): OAuthAccountData {
	return {
		userId,
		providerId,
		accountId: providerUserId,
		accessToken: null,
		refreshToken: null,
		idToken: null,
		accessTokenExpiresAt:
			tokens?.expiresIn != null
				? new Date(now.getTime() + tokens.expiresIn * 1000)
				: (existingAccount?.accessTokenExpiresAt ?? null),
		scope: tokens?.scope ?? existingAccount?.scope ?? null,
		lastLoginAt: now,
		accessTokenEncrypted: preserveOrEncrypt(
			tokens?.accessToken,
			existingAccount?.accessTokenEncrypted
		),
		refreshTokenEncrypted: preserveOrEncrypt(
			tokens?.refreshToken,
			existingAccount?.refreshTokenEncrypted
		),
		idTokenEncrypted: preserveOrEncrypt(tokens?.idToken, existingAccount?.idTokenEncrypted)
	};
}
