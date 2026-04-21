import { eq, or, sql } from 'drizzle-orm';
import { getDb, type NewUser, type User } from '../db/index.js';
import { accounts, users } from '../db/schema.js';
import { getPaginatedItems, sanitizeSearchInput } from '../db/utils.js';
import { bindUserToDefaultPoliciesInTx, syncUserPolicyBindingsInTx } from '../rbac-defaults.js';
import { generateUserId, hashPassword, normalizeUsername } from './passwords.js';
import type { UserPreferences } from '$lib/types/user';

// User management
export async function createUser(
	username: string,
	password: string,
	role: 'admin' | 'editor' | 'viewer' = 'viewer',
	email?: string
): Promise<User> {
	const db = await getDb();
	const passwordHash = await hashPassword(password);
	const normalizedUsername = normalizeUsername(username);

	const newUser: NewUser = {
		id: generateUserId(),
		username: normalizedUsername,
		name: normalizedUsername,
		role,
		email: email || null,
		active: true
	};

	const user = await db.transaction((tx) => {
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

		const createdUser = tx.select().from(users).where(eq(users.id, newUser.id)).get();

		if (!createdUser) {
			throw new Error('Failed to create user');
		}

		// Auto-bind user to default RBAC policies based on role
		bindUserToDefaultPoliciesInTx(tx, createdUser);
		return createdUser;
	});

	return user;
}

export async function getUserById(id: string): Promise<User | null> {
	const db = await getDb();
	const user = await db.query.users.findFirst({
		where: eq(users.id, id)
	});
	return user || null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
	const db = await getDb();
	const normalizedUsername = normalizeUsername(username);
	const user = await db.query.users.findFirst({
		where: eq(users.username, normalizedUsername)
	});
	return user || null;
}

export async function updateUser(
	id: string,
	updates: Partial<Pick<User, 'role' | 'active' | 'email'>>
): Promise<User | null> {
	const db = await getDb();

	return await db.transaction((tx) => {
		const currentUser = tx.select().from(users).where(eq(users.id, id)).get();
		if (!currentUser) return null;

		const roleChanged = updates.role !== undefined && updates.role !== currentUser.role;

		tx.update(users)
			.set({ ...updates, updatedAt: new Date() })
			.where(eq(users.id, id))
			.run();

		const updatedUser = tx.select().from(users).where(eq(users.id, id)).get();
		if (!updatedUser) return null;

		// If role changed, sync RBAC policy bindings in the same transaction
		if (roleChanged) {
			syncUserPolicyBindingsInTx(tx, updatedUser);
		}

		return updatedUser;
	});
}

export async function deleteUser(id: string): Promise<void> {
	const db = await getDb();
	await db.delete(users).where(eq(users.id, id));
}

export async function listUsers(): Promise<User[]> {
	const db = await getDb();
	return db.query.users.findMany({
		orderBy: (users, { desc }) => [desc(users.createdAt)]
	});
}

export async function listUsersPaginated(options?: {
	search?: string;
	limit?: number;
	offset?: number;
}): Promise<{ users: User[]; total: number }> {
	const result = await getPaginatedItems<typeof users, User>(
		users,
		(db) => db.query.users,
		options,
		(search) => {
			const sanitized = sanitizeSearchInput(search);
			const pattern = `%${sanitized}%`;
			return or(
				sql`${users.username} LIKE ${pattern} ESCAPE '\\'`,
				sql`${users.email} LIKE ${pattern} ESCAPE '\\'`
			);
		}
	);

	return { users: result.items, total: result.total };
}

export function serializeUser(user: User | null): {
	id: string;
	username: string;
	role: string;
	email: string | null;
	isLocal: boolean;
	preferences: UserPreferences | null;
} | null {
	if (!user) return null;
	return {
		id: user.id,
		username: user.username,
		role: user.role,
		email: user.email,
		isLocal: user.isLocal,
		preferences: user.preferences || null
	};
}
