import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { users, type AuthProvider, type User } from '$lib/server/db/schema';
import { deleteUserSessions, updateUser } from '$lib/server/auth';
import { bindUserToDefaultPolicies } from '../rbac-defaults.js';
import { logger } from '../logger.js';
import type { OAuthUserInfo } from './oauth/types';
import { extractEmail, canonicalizeEmail } from './sso-claims.js';
import { mapRoleFromGroups } from './role-mapping.js';
import type { SSOUserResult } from './sso';

type Db = Awaited<ReturnType<typeof getDb>>;

export async function updateLinkedSSOUser(
	db: Db,
	userId: string,
	userInfo: OAuthUserInfo,
	providerConfig: AuthProvider
): Promise<SSOUserResult> {
	const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
	if (!user) {
		logger.warn(`Orphaned provider link found for userId ${userId}`);
		return { user: null, reason: 'user_not_found' };
	}

	if (!user.active) {
		logger.warn(`Blocked SSO login attempt for disabled user ${user.id}`);
		return { user: null, reason: 'user_disabled' };
	}

	const profileUpdates = buildProfileUpdates(user, userInfo, providerConfig);
	if (Object.keys(profileUpdates).length > 0) {
		await db
			.update(users)
			.set({ ...profileUpdates, updatedAt: new Date() })
			.where(eq(users.id, user.id));
	}

	const newRole = mapRoleFromGroups(
		userInfo.groups || [],
		providerConfig.roleMapping,
		providerConfig.defaultRole
	);
	if (newRole !== user.role) return syncLinkedUserRole(user, newRole);

	const refreshedUser =
		Object.keys(profileUpdates).length > 0
			? await db.query.users.findFirst({ where: eq(users.id, user.id) })
			: user;
	if (refreshedUser) await bindUserToDefaultPolicies(refreshedUser);
	return { user: refreshedUser ?? null };
}

function buildProfileUpdates(
	user: User,
	userInfo: OAuthUserInfo,
	providerConfig: AuthProvider
): Partial<User> {
	const updates: Partial<User> = {};
	const nextName = typeof userInfo.name === 'string' ? userInfo.name : undefined;
	const nextImage = typeof userInfo.picture === 'string' ? userInfo.picture : undefined;
	const nextEmail = extractEmail(userInfo, providerConfig);
	const currentEmail = canonicalizeEmail(user.email);
	const nextEmailVerified =
		typeof userInfo.emailVerified === 'boolean' ? userInfo.emailVerified : undefined;

	if (nextName !== undefined && user.name !== nextName) updates.name = nextName;
	if (nextImage !== undefined && (user.image ?? null) !== nextImage) updates.image = nextImage;

	if (nextEmail !== undefined && currentEmail !== nextEmail) {
		updates.email = nextEmail;
		updates.emailVerified = nextEmailVerified === true;
	} else if (
		nextEmail !== undefined &&
		nextEmailVerified === false &&
		user.emailVerified !== false
	) {
		updates.emailVerified = false;
	} else if (nextEmail !== undefined && nextEmailVerified === true && user.emailVerified !== true) {
		updates.emailVerified = true;
	}

	return updates;
}

async function syncLinkedUserRole(user: User, newRole: User['role']): Promise<SSOUserResult> {
	logger.info(
		`SSO role change detected for user ${user.username}: ${user.role} -> ${newRole}; syncing RBAC bindings`
	);
	const updatedUser = await updateUser(user.id, { role: newRole });
	if (!updatedUser) {
		logger.error(`Failed to update role for user ${user.id} to ${newRole} during SSO login`);
		throw new Error(`Failed to update SSO user role for user ${user.id}`);
	}

	try {
		await deleteUserSessions(user.id);
		logger.info(`Revoked existing sessions for user ${user.id} after role change to ${newRole}`);
	} catch (err) {
		logger.error(
			err,
			`Failed to revoke sessions for user ${user.id} after role change; rolling back role to ${user.role}`
		);
		await rollbackLinkedUserRole(user, err);
		throw err;
	}

	return { user: updatedUser };
}

async function rollbackLinkedUserRole(user: User, revocationError: unknown): Promise<void> {
	try {
		const rolledBack = await updateUser(user.id, { role: user.role });
		if (rolledBack) return;
		logger.error(
			{ revocationError, userId: user.id, role: user.role },
			`Rollback failed: updateUser returned null for user ${user.id}; DB may be inconsistent (role changed but sessions not revoked)`
		);
	} catch (rollbackError) {
		logger.error(
			{ revocationError, rollbackError, userId: user.id, role: user.role },
			`Rollback threw for user ${user.id}; DB may be inconsistent (role changed but sessions not revoked)`
		);
	}

	throw new Error(
		`Session revocation and role rollback both failed for user ${user.id}; DB may be inconsistent`
	);
}
