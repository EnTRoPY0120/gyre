import { logger } from '../logger.js';
import { getDbSync, type NewUser, type User } from '../db/index.js';
import { accounts, users } from '../db/schema.js';
import { sql } from 'drizzle-orm';
import { unlinkSync } from 'node:fs';
import { loginAttemptsTotal } from '../metrics.js';
import {
	generateStrongPassword,
	generateUserId,
	hashPassword,
	warnIfWeakAdminPassword
} from './passwords.js';
import { getUserByUsername } from './users.js';
import { verifyManagedUserPassword } from './credentials.js';
import { isInClusterMode, loadOrCreateInClusterAdmin } from './in-cluster-admin.js';

// Tracks whether a setup token file has been written and not yet consumed
let pendingSetupCleanup = false;

// Path to the local-dev setup token file; cleared after first successful login
let setupTokenFilePath: string | null = null;

export function setSetupTokenFile(filePath: string): void {
	setupTokenFilePath = filePath;
}

export function cleanupSetupTokenFile(): void {
	if (!pendingSetupCleanup || setupTokenFilePath === null) return;
	const filePath = setupTokenFilePath;
	try {
		unlinkSync(filePath);
		setupTokenFilePath = null;
		pendingSetupCleanup = false;
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
			setupTokenFilePath = null;
			pendingSetupCleanup = false;
		} else {
			logger.error(
				{ err, filePath },
				'[Auth] Failed to remove setup token file; manual removal may be required'
			);
		}
	}
}

// Check if any users exist (for initial setup)
export async function hasUsers(): Promise<boolean> {
	try {
		const db = getDbSync();
		const result = db
			.select({ count: sql<number>`count(*)` })
			.from(users)
			.get();
		return (result?.count ?? 0) > 0;
	} catch {
		// Table doesn't exist yet - no users
		return false;
	}
}

/**
 * Create default admin if no users exist
 * - In-cluster mode: Uses K8s secret for password
 * - Local development: Uses ADMIN_PASSWORD env var or generates a password
 */
export async function createDefaultAdminIfNeeded(): Promise<{
	password: string | null;
	mode: string;
}> {
	const hasAnyUsers = await hasUsers();

	if (hasAnyUsers) {
		return { password: null, mode: isInClusterMode() ? 'in-cluster' : 'local' };
	}

	// In-cluster mode: Use K8s secret
	if (isInClusterMode()) {
		const password = await loadOrCreateInClusterAdmin();
		if (password) {
			const db = getDbSync();
			const newUser: NewUser = {
				id: generateUserId(),
				username: 'admin',
				name: 'admin',
				role: 'admin',
				email: 'admin@gyre.local',
				active: true,
				requiresPasswordChange: false
			};
			db.transaction((tx) => {
				tx.insert(users).values(newUser).run();
				// Keep a credential account row for symmetry with local mode while
				// leaving the Kubernetes secret as the sole password source of truth.
				tx.insert(accounts)
					.values({
						id: generateUserId(),
						providerId: 'credential',
						accountId: newUser.id,
						userId: newUser.id,
						password: null
					})
					.run();
			});
			return { password, mode: 'in-cluster' };
		}
		return { password: null, mode: 'in-cluster' };
	}

	// Local development mode: Use env var or generate password
	const password = process.env.ADMIN_PASSWORD || generateStrongPassword();
	if (process.env.ADMIN_PASSWORD) warnIfWeakAdminPassword(process.env.ADMIN_PASSWORD);
	pendingSetupCleanup = true;

	const db = getDbSync();
	const passwordHash = await hashPassword(password);
	const newUser: NewUser = {
		id: generateUserId(),
		username: 'admin',
		name: 'admin',
		role: 'admin',
		email: 'admin@gyre.local',
		active: true,
		requiresPasswordChange: true
	};
	db.transaction((tx) => {
		tx.insert(users).values(newUser).run();
		tx.insert(accounts)
			.values({
				id: generateUserId(),
				providerId: 'credential',
				accountId: newUser.id,
				userId: newUser.id,
				password: passwordHash
			})
			.run();
	});

	return { password, mode: 'local' };
}

/**
 * Authenticate user
 * - In-cluster mode: Admin validates against K8s secret, others against SQLite
 * - Local dev mode: All users validate against SQLite
 */
export async function authenticateUser(username: string, password: string): Promise<User | null> {
	const user = await getUserByUsername(username);

	if (!user || !user.active) {
		loginAttemptsTotal.labels('failure').inc();
		return null;
	}

	const isValid = await verifyManagedUserPassword(user, password);

	if (!isValid) {
		loginAttemptsTotal.labels('failure').inc();
		return null;
	}

	loginAttemptsTotal.labels('success').inc();

	// First successful login: delete the setup token file so credentials do not
	// persist on disk beyond first use.
	cleanupSetupTokenFile();

	return user;
}
