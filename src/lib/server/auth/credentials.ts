import bcrypt from 'bcryptjs';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb, type Account, type User } from '../db/index.js';
import { accounts, passwordHistory, users } from '../db/schema.js';
import { PASSWORD_HISTORY_LIMIT, SALT_ROUNDS } from './constants.js';
import { generateUserId, hashPassword, normalizeUsername, verifyPassword } from './passwords.js';
import { isInClusterMode, validateInClusterAdmin } from './in-cluster-admin.js';

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>['transaction']>[0]>[0];

function prunePasswordHistoryInTx(tx: Tx, userId: string): void {
	const rows = tx
		.select({ id: passwordHistory.id })
		.from(passwordHistory)
		.where(eq(passwordHistory.userId, userId))
		.orderBy(desc(passwordHistory.createdAtMs))
		.all();

	if (rows.length > PASSWORD_HISTORY_LIMIT) {
		const toDelete = rows.slice(PASSWORD_HISTORY_LIMIT).map((r) => r.id);
		tx.delete(passwordHistory).where(inArray(passwordHistory.id, toDelete)).run();
	}
}

// Pre-computed dummy hash for constant-time comparisons (prevents timing-based enumeration)
const DUMMY_HASH: Promise<string> = bcrypt.hash('__dummy_password_for_timing__', SALT_ROUNDS);

export async function getCredentialPasswordHash(userId: string): Promise<string | null> {
	const db = await getDb();
	const user = await db.query.users.findFirst({
		where: eq(users.id, userId)
	});

	if (!user) {
		return null;
	}

	if (normalizeUsername(user.username) === 'admin' && isInClusterMode()) {
		return null;
	}

	const account = await db.query.accounts.findFirst({
		where: and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential'))
	});

	return account?.password || null;
}

export async function getCredentialAccount(userId: string): Promise<Account | null> {
	const db = await getDb();
	const account = await db.query.accounts.findFirst({
		where: and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential'))
	});

	return account || null;
}

export async function hasManagedPassword(userId: string): Promise<boolean> {
	return Boolean(await getCredentialPasswordHash(userId));
}

export async function clearRequiresPasswordChange(userId: string): Promise<void> {
	const db = await getDb();
	await db.update(users).set({ requiresPasswordChange: false }).where(eq(users.id, userId));
}

// Internal helper: fetch the credential hash directly by userId, skipping the
// user-row re-fetch and in-cluster-admin re-check. Callers must have already
// handled the in-cluster-admin case before calling this.
async function getCredentialHashDirect(userId: string): Promise<string | null> {
	const db = await getDb();
	const account = await db.query.accounts.findFirst({
		where: and(eq(accounts.userId, userId), eq(accounts.providerId, 'credential'))
	});
	return account?.password || null;
}

export async function verifyManagedUserPassword(user: User, password: string): Promise<boolean> {
	if (normalizeUsername(user.username) === 'admin' && isInClusterMode()) {
		return validateInClusterAdmin(password);
	}

	const credentialPasswordHash = await getCredentialHashDirect(user.id);
	if (!credentialPasswordHash) {
		// Run dummy verification to prevent timing-based enumeration of SSO vs credential accounts
		await verifyPassword(password, await DUMMY_HASH);
		return false;
	}

	return verifyPassword(password, credentialPasswordHash);
}

export async function addPasswordHistory(userId: string, oldPasswordHash: string): Promise<void> {
	const db = await getDb();
	const now = Date.now();

	// Insert and prune atomically so a crash between the two operations cannot
	// leave the history table with more than PASSWORD_HISTORY_LIMIT entries.
	// Ordering by createdAtMs (milliseconds) avoids ties at second resolution.
	// The unique index on (user_id, password_hash) makes this idempotent across
	// retries and concurrent rotations of the same live credential.
	await db.transaction((tx) => {
		tx.insert(passwordHistory)
			.values({
				id: generateUserId(),
				userId,
				passwordHash: oldPasswordHash,
				createdAtMs: now
			})
			.onConflictDoNothing()
			.run();

		prunePasswordHistoryInTx(tx, userId);
	});
}

export async function isPasswordInHistory(
	userId: string,
	candidatePassword: string
): Promise<boolean> {
	const db = await getDb();
	const rows = await db.query.passwordHistory.findMany({
		where: eq(passwordHistory.userId, userId),
		orderBy: [desc(passwordHistory.createdAtMs)],
		limit: PASSWORD_HISTORY_LIMIT
	});

	for (const row of rows) {
		if (await bcrypt.compare(candidatePassword, row.passwordHash)) {
			return true;
		}
	}
	return false;
}

export async function updateUserPassword(id: string, newPassword: string): Promise<void> {
	const db = await getDb();

	// Hash before the transaction — bcrypt is async and cannot run inside a sync tx callback.
	const newPasswordHash = await hashPassword(newPassword);
	const now = Date.now();

	await db.transaction((tx) => {
		const existingUser = tx.select({ id: users.id }).from(users).where(eq(users.id, id)).get();

		if (!existingUser) {
			throw new Error('User not found');
		}

		const currentCredential = tx
			.select({ password: accounts.password })
			.from(accounts)
			.where(and(eq(accounts.userId, id), eq(accounts.providerId, 'credential')))
			.get();
		const currentCredentialHash = currentCredential?.password || null;

		// Archive the old hash and prune history atomically with the password update
		// so a crash between the two operations cannot leave the DB in a partial state.
		if (currentCredentialHash) {
			tx.insert(passwordHistory)
				.values({
					id: generateUserId(),
					userId: id,
					passwordHash: currentCredentialHash,
					createdAtMs: now
				})
				.onConflictDoNothing()
				.run();

			prunePasswordHistoryInTx(tx, id);
		}

		const updatedCredentialAccount = tx
			.update(accounts)
			.set({ password: newPasswordHash, updatedAt: new Date() })
			.where(and(eq(accounts.userId, id), eq(accounts.providerId, 'credential')))
			.run();

		if (updatedCredentialAccount.changes === 0) {
			tx.insert(accounts)
				.values({
					id: generateUserId(),
					providerId: 'credential',
					accountId: id,
					userId: id,
					password: newPasswordHash
				})
				.run();
		}
	});
}
