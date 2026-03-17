/**
 * SSO User Auto-Provisioning
 * Handles automatic user creation and role mapping from SSO providers.
 */

import { logger } from '../logger.js';
import { getDb } from '$lib/server/db';
import { users, userProviders, type AuthProvider } from '$lib/server/db/schema';
import type { User } from '$lib/server/db/schema';
import {
	generateUserId,
	normalizeUsername,
	updateUser,
	deleteUserSessions
} from '$lib/server/auth';
import { bindUserToDefaultPolicies } from '../rbac-defaults.js';
import type { OAuthUserInfo } from './oauth/types';
import { eq, and } from 'drizzle-orm';
import { getAuthSettings } from '../settings.js';

/**
 * SSO User Creation Result
 */
export interface SSOUserResult {
	user: User | null;
	reason?: 'signup_disabled' | 'domain_not_allowed' | 'auto_provision_disabled' | 'user_not_found';
}

/**
 * Create or update a user from SSO login.
 * If the user already exists (linked via userProviders), update last login.
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
	providerConfig: AuthProvider
): Promise<SSOUserResult> {
	const db = await getDb();

	// Check if user already exists via provider link
	const existingLink = await db.query.userProviders.findFirst({
		where: and(
			eq(userProviders.providerId, providerId),
			eq(userProviders.providerUserId, userInfo.sub)
		)
	});

	if (existingLink) {
		// User exists - update last login time
		await db
			.update(userProviders)
			.set({ lastLoginAt: new Date() })
			.where(
				and(eq(userProviders.userId, existingLink.userId), eq(userProviders.providerId, providerId))
			);

		// Get and return user
		const user = await db.query.users.findFirst({
			where: eq(users.id, existingLink.userId)
		});

		if (!user) {
			logger.warn(`Orphaned provider link found for userId ${existingLink.userId}`);
			return { user: null, reason: 'user_not_found' };
		}

		// Re-evaluate role from current IdP groups in case membership changed
		const newRole = mapRoleFromGroups(
			userInfo.groups || [],
			providerConfig.roleMapping,
			providerConfig.defaultRole
		);

		if (newRole !== user.role) {
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
				logger.info(
					`Revoked existing sessions for user ${user.id} after role change to ${newRole}`
				);
			} catch (err) {
				logger.error(
					err,
					`Failed to revoke sessions for user ${user.id} after role change; rolling back role to ${user.role}`
				);
				try {
					const rolledBack = await updateUser(user.id, { role: user.role });
					if (!rolledBack) {
						logger.error(
							{ revocationError: err, userId: user.id, role: user.role },
							`Rollback failed: updateUser returned null for user ${user.id}; DB may be inconsistent (role changed but sessions not revoked)`
						);
						throw new Error(
							`Session revocation and role rollback both failed for user ${user.id}; DB may be inconsistent`
						);
					}
				} catch (rollbackErr) {
					if (
						rollbackErr instanceof Error &&
						rollbackErr.message.includes('Session revocation and role rollback')
					) {
						throw rollbackErr;
					}
					logger.error(
						{ revocationError: err, rollbackError: rollbackErr, userId: user.id, role: user.role },
						`Rollback threw for user ${user.id}; DB may be inconsistent (role changed but sessions not revoked)`
					);
					throw new Error(
						`Session revocation and role rollback both failed for user ${user.id}; DB may be inconsistent`
					);
				}
				throw err;
			}
			return { user: updatedUser };
		}

		return { user };
	}

	// User doesn't exist - check auth settings and provider config
	const authSettings = await getAuthSettings();

	// Check if signup is allowed
	if (!authSettings.allowSignup) {
		logger.info(`Signup disabled, user ${userInfo.sub} not allowed to register`);
		return { user: null, reason: 'signup_disabled' };
	}

	// Check if auto-provisioning is enabled for this provider
	if (!providerConfig.autoProvision) {
		logger.info(
			`Auto-provisioning disabled for provider ${providerId}, user ${userInfo.sub} not found`
		);
		return { user: null, reason: 'auto_provision_disabled' };
	}

	// Extract username and email from user info
	const username = normalizeUsername(extractUsername(userInfo, providerConfig));
	if (!username) {
		logger.error(
			`Could not extract a valid username for SSO user ${userInfo.sub} from provider ${providerId}`
		);
		return { user: null, reason: 'user_not_found' };
	}
	const email = extractEmail(userInfo, providerConfig);

	// Check domain allowlist (only for new users)
	if (authSettings.domainAllowlist.length > 0) {
		if (!email) {
			logger.info(`No email found for user ${userInfo.sub}, cannot verify domain`);
			return { user: null, reason: 'domain_not_allowed' };
		}

		const domain = email.split('@')[1]?.toLowerCase();
		// Normalize allowlist for comparison
		const normalizedAllowlist = authSettings.domainAllowlist.map((d) => d.trim().toLowerCase());

		if (!domain || !normalizedAllowlist.includes(domain)) {
			logger.info(`Domain ${domain} not in allowlist for user ${userInfo.sub}`);
			return { user: null, reason: 'domain_not_allowed' };
		}
	}

	// Auto-provision new user
	const role = mapRoleFromGroups(
		userInfo.groups || [],
		providerConfig.roleMapping,
		providerConfig.defaultRole
	);

	// Check if username already exists (shouldn't happen, but handle it)
	let finalUsername = username;
	const existingUsername = await db.query.users.findFirst({
		where: eq(users.username, username)
	});

	if (existingUsername) {
		// Append random suffix to make username unique
		finalUsername = `${username}_${userInfo.sub.substring(0, 8)}`;
		logger.info(`Username ${username} exists, using ${finalUsername} instead`);
	}

	// Create new user
	const userId = generateUserId();
	const newUser = {
		id: userId,
		username: finalUsername,
		passwordHash: '', // No password for SSO users
		email: email || null,
		role: role,
		active: true,
		isLocal: false // Mark as SSO user
	};

	await db.insert(users).values(newUser);

	// Get the created user for binding policies
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId)
	});

	if (!user) {
		throw new Error('Failed to create SSO user');
	}

	// Auto-bind user to default RBAC policies based on role
	await bindUserToDefaultPolicies(user);

	// Link user to provider
	await db.insert(userProviders).values({
		userId: userId,
		providerId: providerId,
		providerUserId: userInfo.sub,
		lastLoginAt: new Date()
	});

	logger.info(
		`Auto-provisioned new SSO user: ${finalUsername} with role ${role} from provider ${providerId}`
	);

	return { user };
}

/**
 * Map IdP groups to Gyre roles.
 * Role mapping format: { "admin": ["Admins", "DevOps"], "editor": ["Developers"] }
 *
 * @param groups - Groups from IdP
 * @param roleMapping - Role mapping JSON string
 * @param defaultRole - Fallback role if no mapping matches
 * @returns Mapped role (admin, editor, or viewer)
 */
function mapRoleFromGroups(
	groups: string[],
	roleMapping: string | null,
	defaultRole: string
): 'admin' | 'editor' | 'viewer' {
	// Clamp defaultRole: admin can only be granted via explicit group membership,
	// and unrecognised values fall back to 'viewer' (least privilege).
	const normalizedDefault = defaultRole.trim().toLowerCase();
	let safeDefaultRole: 'editor' | 'viewer';
	if (normalizedDefault === 'admin') {
		logger.warn(
			'[Security] SSO provider defaultRole is "admin"; restricting fallback to "editor" to prevent privilege escalation. Assign admin via explicit group mapping.'
		);
		safeDefaultRole = 'editor';
	} else if (normalizedDefault === 'editor') {
		safeDefaultRole = 'editor';
	} else if (normalizedDefault === 'viewer') {
		safeDefaultRole = 'viewer';
	} else {
		logger.warn(
			`[Security] SSO provider defaultRole has unrecognised value "${defaultRole}"; falling back to least-privilege "viewer".`
		);
		safeDefaultRole = 'viewer';
	}

	// No mapping configured - use default role
	if (!roleMapping) {
		return safeDefaultRole;
	}

	// Parse role mapping
	let mapping: Record<string, string[]>;
	try {
		mapping = JSON.parse(roleMapping);
	} catch (error) {
		logger.error(error, 'Failed to parse role mapping:');
		return safeDefaultRole;
	}

	// Check admin groups first (highest priority)
	if (mapping.admin && Array.isArray(mapping.admin)) {
		if (groups.some((g) => mapping.admin.includes(g))) {
			return 'admin';
		}
	}

	// Check editor groups
	if (mapping.editor && Array.isArray(mapping.editor)) {
		if (groups.some((g) => mapping.editor.includes(g))) {
			return 'editor';
		}
	}

	// Check viewer groups
	if (mapping.viewer && Array.isArray(mapping.viewer)) {
		if (groups.some((g) => mapping.viewer.includes(g))) {
			return 'viewer';
		}
	}

	// No matching groups - use default role
	return safeDefaultRole;
}

/**
 * Extract username from user info using configured claim path.
 * Supports nested claims (e.g., "profile.username").
 *
 * @param userInfo - User information from IdP
 * @param config - Provider configuration
 * @returns Username string
 */
function extractUsername(userInfo: OAuthUserInfo, config: AuthProvider): string {
	// Try configured claim path
	const username = extractClaim(userInfo, config.usernameClaim);
	if (username) {
		return sanitizeUsername(username);
	}

	// Fallback: try common username fields
	if (userInfo.username) {
		return sanitizeUsername(userInfo.username);
	}

	// Fallback: use email local part
	if (userInfo.email) {
		const localPart = userInfo.email.split('@')[0];
		return sanitizeUsername(localPart);
	}

	// Last resort: use sub (IdP user ID)
	return sanitizeUsername(userInfo.sub);
}

/**
 * Extract email from user info using configured claim path.
 *
 * @param userInfo - User information from IdP
 * @param config - Provider configuration
 * @returns Email string or undefined
 */
function extractEmail(userInfo: OAuthUserInfo, config: AuthProvider): string | undefined {
	const email = extractClaim(userInfo, config.emailClaim);
	if (email && isValidEmail(email)) {
		return email;
	}

	// Fallback to userInfo.email
	if (userInfo.email && isValidEmail(userInfo.email)) {
		return userInfo.email;
	}

	return undefined;
}

/**
 * Extract a claim from user info using a path (supports nested claims).
 * Path format: "key" or "nested.key" or "deep.nested.key"
 *
 * @param userInfo - User information object
 * @param claimPath - Dot-separated path to claim
 * @returns Claim value as string or undefined
 */
function extractClaim(userInfo: Record<string, unknown>, claimPath: string): string | undefined {
	const parts = claimPath.split('.');
	let value: unknown = userInfo;

	for (const part of parts) {
		if (value && typeof value === 'object' && part in value) {
			value = (value as Record<string, unknown>)[part];
		} else {
			return undefined;
		}
	}

	return typeof value === 'string' ? value : undefined;
}

/**
 * Sanitize username for database storage.
 * - Remove special characters
 * - Lowercase
 * - Replace spaces with underscores
 * - Limit length
 *
 * @param username - Raw username
 * @returns Sanitized username
 */
function sanitizeUsername(username: string): string {
	return username
		.toLowerCase()
		.replace(/[^a-z0-9_.-]/g, '_') // Replace invalid chars with underscore
		.replace(/_{2,}/g, '_') // Collapse multiple underscores
		.replace(/^[_.-]+|[_.-]+$/g, '') // Remove leading/trailing special chars
		.substring(0, 50); // Limit length
}

/**
 * Validate email format.
 *
 * @param email - Email string to validate
 * @returns True if valid email format
 */
function isValidEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}
