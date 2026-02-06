import bcrypt from 'bcryptjs';
import { getDb, getDbSync, type NewUser, type NewSession, type User } from './db/index.js';
import { users, sessions } from './db/schema.js';
import { eq, and, gt, sql } from 'drizzle-orm';
import { randomBytes, randomInt } from 'node:crypto';
import { bindUserToDefaultPolicies } from './rbac-defaults.js';
import * as k8s from '@kubernetes/client-node';
import { readFileSync } from 'node:fs';

// In-cluster configuration paths
const IN_CLUSTER_TOKEN_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/token';
const IN_CLUSTER_CA_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
const IN_CLUSTER_NAMESPACE_PATH = '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

const SALT_ROUNDS = 12;
const SESSION_DURATION_DAYS = 7;
const ADMIN_SECRET_NAME = 'gyre-initial-admin-secret';

// Store generated password temporarily for first-time setup display
let generatedAdminPassword: string | null = null;

// For in-cluster mode: password read from K8s secret (stored hashed)
let inClusterAdminPasswordHash: string | null = null;
let inClusterFirstLoginDone = false;

/**
 * Generate a strong random password
 * Format: 3 random words + 3 random digits + 1 special char
 * Easy to read but secure (e.g., "BlueTiger7Sky#42")
 */
export function generateStrongPassword(): string {
	const words = [
		'Alpha',
		'Beta',
		'Gamma',
		'Delta',
		'Echo',
		'Fox',
		'Hawk',
		'Lion',
		'Bear',
		'Wolf',
		'Blue',
		'Red',
		'Green',
		'Gold',
		'Iron',
		'Steel',
		'Fire',
		'Ice',
		'Storm',
		'Thunder',
		'Cloud',
		'Sky',
		'Star',
		'Moon',
		'Sun',
		'Wave',
		'Ocean',
		'Mountain',
		'Forest',
		'River'
	];
	const specials = '!@#$%^&*';

	const word1 = words[randomInt(0, words.length)];
	const word2 = words[randomInt(0, words.length)];
	const word3 = words[randomInt(0, words.length)];
	const digits = randomInt(10, 100).toString();
	const special = specials[randomInt(0, specials.length)];

	return `${word1}${word2}${digits}${word3}${special}`;
}

/**
 * Get the generated admin password (for initial setup display)
 */
export function getGeneratedAdminPassword(): string | null {
	return generatedAdminPassword;
}

// Password hashing
export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

// Session ID generation
export function generateSessionId(): string {
	return randomBytes(32).toString('hex');
}

export function generateUserId(): string {
	return randomBytes(16).toString('hex');
}

// User management
export async function createUser(
	username: string,
	password: string,
	role: 'admin' | 'editor' | 'viewer' = 'viewer',
	email?: string
): Promise<User> {
	const db = await getDb();
	const passwordHash = await hashPassword(password);

	const newUser: NewUser = {
		id: generateUserId(),
		username,
		passwordHash,
		role,
		email: email || null,
		active: true
	};

	await db.insert(users).values(newUser);
	const user = await db.query.users.findFirst({
		where: eq(users.id, newUser.id)
	});

	if (!user) {
		throw new Error('Failed to create user');
	}

	// Auto-bind user to default RBAC policies based on role
	await bindUserToDefaultPolicies(user);

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
	const user = await db.query.users.findFirst({
		where: eq(users.username, username)
	});
	return user || null;
}

export async function updateUser(
	id: string,
	updates: Partial<Pick<User, 'role' | 'active' | 'email'>>
): Promise<User | null> {
	const db = await getDb();

	// Get current user to check if role is changing
	const currentUser = await getUserById(id);
	const roleChanged = updates.role && currentUser && updates.role !== currentUser.role;

	await db
		.update(users)
		.set({ ...updates, updatedAt: new Date() })
		.where(eq(users.id, id));

	const updatedUser = await getUserById(id);

	// If role changed, sync RBAC policy bindings
	if (roleChanged && updatedUser) {
		const { syncUserPolicyBindings } = await import('./rbac-defaults.js');
		await syncUserPolicyBindings(updatedUser);
	}

	return updatedUser;
}

export async function updateUserPassword(id: string, newPassword: string): Promise<void> {
	const db = await getDb();
	const passwordHash = await hashPassword(newPassword);
	await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
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

// Session management
export async function createSession(
	userId: string,
	ipAddress?: string,
	userAgent?: string
): Promise<string> {
	const db = await getDb();
	const sessionId = generateSessionId();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

	const newSession: NewSession = {
		id: sessionId,
		userId,
		expiresAt,
		ipAddress: ipAddress || null,
		userAgent: userAgent || null
	};

	await db.insert(sessions).values(newSession);
	return sessionId;
}

export async function getSession(
	sessionId: string
): Promise<{ session: typeof sessions.$inferSelect; user: User } | null> {
	const db = await getDb();
	const now = new Date();

	// Query session first
	const session = await db.query.sessions.findFirst({
		where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now))
	});

	if (!session) {
		return null;
	}

	// Query user separately (manual join to avoid ORM relation issues)
	const user = await db.query.users.findFirst({
		where: eq(users.id, session.userId)
	});

	if (!user) {
		return null;
	}

	return { session, user };
}

export async function deleteSession(sessionId: string): Promise<void> {
	const db = await getDb();
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteUserSessions(userId: string): Promise<void> {
	const db = await getDb();
	await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function cleanupExpiredSessions(): Promise<void> {
	const db = await getDb();
	const now = new Date();
	await db.delete(sessions).where(gt(sessions.expiresAt, now));
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

// Get current namespace from in-cluster ServiceAccount
function getCurrentNamespace(): string {
	try {
		return readFileSync(IN_CLUSTER_NAMESPACE_PATH, 'utf-8').trim();
	} catch {
		return 'default';
	}
}

// Create Kubernetes Core API client (works both in-cluster and locally)
async function createK8sClient(): Promise<k8s.CoreV1Api> {
	const { loadKubeConfig } = await import('./kubernetes/config.js');
	const kc = loadKubeConfig();
	return kc.makeApiClient(k8s.CoreV1Api);
}

/**
 * Check if the initial admin secret has been marked as consumed
 */
async function isSecretConsumed(api: k8s.CoreV1Api, namespace: string): Promise<boolean> {
	try {
		const result = await api.readNamespacedSecret({
			name: ADMIN_SECRET_NAME,
			namespace
		});
		const labels = result.metadata?.labels || {};
		return labels['gyre.io/initial-password-consumed'] === 'true';
	} catch {
		// If secret doesn't exist, it's not consumed
		return false;
	}
}

/**
 * Mark the initial admin secret as consumed after first login
 */
async function markSecretConsumed(api: k8s.CoreV1Api, namespace: string): Promise<void> {
	try {
		// Patch the secret to add the consumed label using JSON Patch format
		const patch = [
			{
				op: 'add',
				path: '/metadata/labels/gyre.io~1initial-password-consumed',
				value: 'true'
			}
		];
		await api.patchNamespacedSecret({
			name: ADMIN_SECRET_NAME,
			namespace,
			body: patch
		});
	} catch (error) {
		console.error('Failed to mark secret as consumed:', error);
	}
}

/**
 * Load or create in-cluster admin password from Kubernetes secret
 * - If secret exists and has password: load it
 * - If secret doesn't exist: generate password and create secret
 * - Returns the plaintext password (for initial display only)
 */
export async function loadOrCreateInClusterAdmin(): Promise<string | null> {
	try {
		const api = await createK8sClient();
		const namespace = getCurrentNamespace();

		// Check if secret already exists
		try {
			const result = await api.readNamespacedSecret({
				name: ADMIN_SECRET_NAME,
				namespace
			});
			const passwordBase64 = result.data?.['password'];

			if (passwordBase64) {
				const password = Buffer.from(passwordBase64, 'base64').toString('utf-8');
				// Hash and store for authentication
				inClusterAdminPasswordHash = await hashPassword(password);

				// Check if already consumed
				inClusterFirstLoginDone = await isSecretConsumed(api, namespace);

				return password;
			}
		} catch (error: unknown) {
			// Secret doesn't exist, will create it below
			const k8sError = error as { response?: { statusCode: number } };
			if (k8sError.response?.statusCode !== 404) {
				throw error;
			}
		}

		// Generate new password
		// Use ADMIN_PASSWORD from env if provided, otherwise generate a strong one
		const password = process.env.ADMIN_PASSWORD || generateStrongPassword();
		generatedAdminPassword = password;

		// Hash for storage
		inClusterAdminPasswordHash = await hashPassword(password);

		// Create the secret
		const secret: k8s.V1Secret = {
			apiVersion: 'v1',
			kind: 'Secret',
			metadata: {
				name: ADMIN_SECRET_NAME,
				namespace,
				labels: {
					'app.kubernetes.io/managed-by': 'gyre',
					'gyre.io/secret-type': 'initial-admin-password'
				}
			},
			stringData: {
				password: password
			}
		};

		await api.createNamespacedSecret({
			namespace,
			body: secret
		});
		console.log(`Created initial admin secret in namespace "${namespace}"`);

		return password;
	} catch (error) {
		console.error('Failed to setup in-cluster admin:', error);
		return null;
	}
}

/**
 * Validate admin login for in-cluster mode
 * - Checks against the K8s secret password
 * - After first successful login, marks secret as consumed
 */
export async function validateInClusterAdmin(password: string): Promise<boolean> {
	if (!inClusterAdminPasswordHash) {
		// Try to load from secret if not already loaded
		await loadOrCreateInClusterAdmin();
	}

	if (!inClusterAdminPasswordHash) {
		return false;
	}

	const isValid = await bcrypt.compare(password, inClusterAdminPasswordHash);

	if (isValid && !inClusterFirstLoginDone) {
		// Mark as consumed
		try {
			const api = await createK8sClient();
			const namespace = getCurrentNamespace();
			await markSecretConsumed(api, namespace);
			inClusterFirstLoginDone = true;
		} catch (error) {
			console.error('Failed to mark secret as consumed:', error);
		}
	}

	return isValid;
}

/**
 * Check if in-cluster admin password has been used
 */
export function isInClusterAdminPasswordConsumed(): boolean {
	return inClusterFirstLoginDone;
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
				passwordHash: '', // Empty hash - we validate against K8s secret
				role: 'admin',
				email: 'admin@gyre.local',
				active: true
			};
			db.insert(users).values(newUser).run();
			return { password, mode: 'in-cluster' };
		}
		return { password: null, mode: 'in-cluster' };
	}

	// Local development mode: Use env var or generate password
	const password = process.env.ADMIN_PASSWORD || generateStrongPassword();
	generatedAdminPassword = password;

	const db = getDbSync();
	const passwordHash = await hashPassword(password);
	const newUser: NewUser = {
		id: generateUserId(),
		username: 'admin',
		passwordHash, // Store hash in SQLite for local dev
		role: 'admin',
		email: 'admin@gyre.local',
		active: true
	};
	db.insert(users).values(newUser).run();

	return { password, mode: 'local' };
}

/**
 * Check if running in-cluster (vs local development)
 */
function isInClusterMode(): boolean {
	return !!process.env.KUBERNETES_SERVICE_HOST;
}

/**
 * Authenticate user
 * - In-cluster mode: Admin validates against K8s secret, others against SQLite
 * - Local dev mode: All users validate against SQLite
 */
export async function authenticateUser(username: string, password: string): Promise<User | null> {
	const user = await getUserByUsername(username);

	if (!user || !user.active) {
		return null;
	}

	let isValid: boolean;

	// In-cluster mode: Admin password is in K8s secret
	// Local dev mode: All passwords (including admin) are in SQLite
	if (username === 'admin' && isInClusterMode()) {
		isValid = await validateInClusterAdmin(password);
	} else {
		// Validate against SQLite password hash
		isValid = await verifyPassword(password, user.passwordHash);
	}

	if (!isValid) {
		return null;
	}

	return user;
}
