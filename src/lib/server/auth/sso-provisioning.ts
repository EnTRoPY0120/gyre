import { and, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { accounts, users, type AuthProvider, type User } from '$lib/server/db/schema';
import { getDb } from '$lib/server/db';
import { generateUserId, normalizeUsername } from '$lib/server/auth';
import { bindUserToDefaultPolicies } from '../rbac-defaults.js';
import type { OAuthTokens, OAuthUserInfo } from './oauth/types';
import type { SSOUserResult } from './sso';
import type { extractEmail, extractUsername } from './sso-claims';
import { mapRoleFromGroups } from './role-mapping';
import { logger } from '../logger.js';
import {
	createSSOAccountRecord,
	createSSOUserRecord,
	getProvisioningAccessReason,
	type AuthSettings
} from './sso-provisioning-helpers.js';

type Db = Awaited<ReturnType<typeof getDb>>;

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
	const newUser = createSSOUserRecord(userId, finalUsername, email, userInfo, role);

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

async function insertUserAndAccount(
	db: Db,
	newUser: ReturnType<typeof createSSOUserRecord>,
	userInfo: OAuthUserInfo,
	providerId: string,
	tokens: OAuthTokens | undefined,
	userId: string
) {
	const account = createSSOAccountRecord(userId, providerId, userInfo, tokens);
	await db.transaction((tx) => {
		tx.insert(users).values(newUser).run();
		tx.insert(accounts).values(account).run();
	});
}

function hashIdentifier(value: string): string {
	return createHash('sha256').update(value).digest('hex').slice(0, 12);
}
