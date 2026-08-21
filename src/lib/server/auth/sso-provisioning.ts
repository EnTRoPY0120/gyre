import { and, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { accounts, users, type AuthProvider, type User } from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { generateUserId, normalizeUsername } from '$lib/server/auth';
import { bindUserToDefaultPolicies } from '../rbac-defaults.js';
import { encryptSecret } from './crypto.js';
import type { OAuthTokens, OAuthUserInfo } from './oauth/types';
import type { SSOUserResult } from './sso';
import type { extractEmail, extractUsername } from './sso-claims';
import { mapRoleFromGroups } from './role-mapping';
import { logger } from '../logger.js';

type Db = Awaited<ReturnType<typeof getDb>>;

type AuthSettings = {
	allowSignup: boolean;
	domainAllowlist: string[];
};

type ClaimExtractors = {
	extractEmail: typeof extractEmail;
	extractUsername: typeof extractUsername;
};

interface ProvisionNewSSOUserOptions {
	db: Db;
	providerId: string;
	userInfo: OAuthUserInfo;
	providerConfig: AuthProvider;
	tokens?: OAuthTokens;
	authSettings: AuthSettings;
	claims: ClaimExtractors;
}

export async function provisionNewSSOUser({
	db,
	providerId,
	userInfo,
	providerConfig,
	tokens,
	authSettings,
	claims
}: ProvisionNewSSOUserOptions): Promise<SSOUserResult> {
	const username = normalizeUsername(claims.extractUsername(userInfo, providerConfig));
	if (!username) {
		logger.error(
			`Could not extract a valid username for SSO user ${userInfo.sub} from provider ${providerId}`
		);
		return { user: null, reason: 'user_not_found' };
	}

	const email = claims.extractEmail(userInfo, providerConfig);
	const disabledReason = await findDisabledUser(db, username, email, providerId);
	if (disabledReason) return { user: null, reason: disabledReason };

	const accessReason = getProvisioningAccessReason(authSettings, providerConfig, email);
	if (accessReason) {
		logger.info(
			`SSO auto-provisioning denied for user ${userInfo.sub}: ${accessReason} (provider ${providerId})`
		);
		return { user: null, reason: accessReason };
	}

	const role = mapRole(userInfo, providerConfig);
	const finalUsername = await findAvailableUsername(db, username, userInfo.sub);
	if (finalUsername !== username) {
		logger.info(`Username ${username} exists, using ${finalUsername} instead`);
	}
	const userId = generateUserId();
	const newUser = createUserRecord(userId, finalUsername, email, userInfo, role);

	await insertUserAndAccount(db, newUser, userInfo, providerId, tokens, userId);
	const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
	if (!user) throw new Error('Failed to create SSO user');

	await bindUserToDefaultPolicies(user);
	logger.info(
		`Auto-provisioned new SSO user: ${finalUsername} with role ${role} from provider ${providerId}`
	);
	return { user, accountLinked: true };
}

async function findDisabledUser(
	db: Db,
	username: string,
	email: string | undefined,
	providerId: string
): Promise<'user_disabled' | null> {
	const disabledByUsername = await db.query.users.findFirst({
		where: and(eq(users.username, username), eq(users.active, false))
	});
	if (disabledByUsername) {
		logger.warn(
			`Blocked SSO auto-provision for disabled username match redactedUsername=${hashIdentifier(username)} on provider ${providerId}`
		);
		return 'user_disabled';
	}

	if (!email) return null;
	const disabledByEmail = await db.query.users.findFirst({
		where: and(sql`lower(${users.email}) = lower(${email})`, eq(users.active, false))
	});
	if (!disabledByEmail) return null;
	logger.warn(
		`Blocked SSO auto-provision for disabled email match redactedEmail=${hashIdentifier(email)} on provider ${providerId}`
	);
	return 'user_disabled';
}

function getProvisioningAccessReason(
	authSettings: AuthSettings,
	providerConfig: AuthProvider,
	email: string | undefined
): SSOUserResult['reason'] {
	if (!authSettings.allowSignup) return 'signup_disabled';
	if (!providerConfig.autoProvision) return 'auto_provision_disabled';
	if (!isAllowedDomain(email, authSettings.domainAllowlist)) return 'domain_not_allowed';
	return undefined;
}

function isAllowedDomain(email: string | undefined, allowlist: string[]): boolean {
	if (allowlist.length === 0) return true;
	const domain = email?.split('@')[1]?.toLowerCase();
	const normalizedAllowlist = allowlist.map((entry) => entry.trim().toLowerCase());
	return Boolean(domain && normalizedAllowlist.includes(domain));
}

function mapRole(userInfo: OAuthUserInfo, providerConfig: AuthProvider): User['role'] {
	return mapRoleFromGroups(
		userInfo.groups || [],
		providerConfig.roleMapping,
		providerConfig.defaultRole
	) as User['role'];
}

async function findAvailableUsername(db: Db, username: string, subject: string): Promise<string> {
	const existingUsername = await db.query.users.findFirst({ where: eq(users.username, username) });
	return existingUsername ? `${username}_${subject.substring(0, 8)}` : username;
}

function createUserRecord(
	id: string,
	username: string,
	email: string | undefined,
	userInfo: OAuthUserInfo,
	role: User['role']
) {
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

async function insertUserAndAccount(
	db: Db,
	newUser: ReturnType<typeof createUserRecord>,
	userInfo: OAuthUserInfo,
	providerId: string,
	tokens: OAuthTokens | undefined,
	userId: string
) {
	await db.transaction((tx) => {
		tx.insert(users).values(newUser).run();
		tx.insert(accounts)
			.values({
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
			})
			.run();
	});
}

function hashIdentifier(value: string): string {
	return createHash('sha256').update(value).digest('hex').slice(0, 12);
}
