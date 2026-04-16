import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq } from 'drizzle-orm';
import type { UserPreferences } from '../lib/types/user.js';
import * as schema from '../lib/server/db/schema.js';
import { users, type User } from '../lib/server/db/schema.js';
import { importFresh } from './helpers/import-fresh';
import { createLoggerModuleStub, createRateLimiterModuleStub } from './helpers/module-stubs';

type PreferencesRouteModule = typeof import('../routes/api/v1/user/preferences/+server.js');
type PreferencesEvent = Parameters<PreferencesRouteModule['POST']>[0];

const state: {
	db: ReturnType<typeof drizzle<typeof schema>> | null;
	sqlite: Database | null;
} = { db: null, sqlite: null };

let POST: PreferencesRouteModule['POST'];

const CREATE_USERS_TABLE = `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		username TEXT NOT NULL UNIQUE,
		email TEXT,
		name TEXT NOT NULL DEFAULT '',
		email_verified INTEGER NOT NULL DEFAULT 0,
		image TEXT,
		role TEXT NOT NULL DEFAULT 'viewer',
		active INTEGER NOT NULL DEFAULT 1,
		is_local INTEGER NOT NULL DEFAULT 1,
		created_at INTEGER NOT NULL DEFAULT (unixepoch()),
		updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
		preferences TEXT,
		requires_password_change INTEGER NOT NULL DEFAULT 0
	)
`;

function setupInMemoryDb() {
	const sqlite = new Database(':memory:');
	sqlite.exec(CREATE_USERS_TABLE);
	return {
		db: drizzle(sqlite, { schema }),
		sqlite
	};
}

function createUser(overrides: Partial<User> = {}): User {
	const now = new Date();
	return {
		id: overrides.id ?? 'user-1',
		username: overrides.username ?? 'prefs-user',
		email: overrides.email ?? 'prefs@example.com',
		name: overrides.name ?? 'Prefs User',
		emailVerified: overrides.emailVerified ?? false,
		image: overrides.image ?? null,
		role: overrides.role ?? 'admin',
		active: overrides.active ?? true,
		isLocal: overrides.isLocal ?? true,
		requiresPasswordChange: overrides.requiresPasswordChange ?? false,
		createdAt: overrides.createdAt ?? now,
		updatedAt: overrides.updatedAt ?? now,
		preferences: overrides.preferences ?? null
	};
}

function buildEvent(user: User, body: unknown): PreferencesEvent {
	const request = new Request('http://localhost/api/v1/user/preferences', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});

	return {
		request,
		locals: {
			requestId: 'req-1',
			cluster: undefined,
			user,
			session: null
		},
		setHeaders: () => {}
	} as PreferencesEvent;
}

beforeEach(async () => {
	const dbModuleMock = {
		getDb: async () => state.db,
		getDbSync: () => state.db,
		schema
	};

	mock.module('$lib/server/db', () => dbModuleMock);
	mock.module('$lib/server/db/index.js', () => dbModuleMock);
	const rateLimiterModuleStub = createRateLimiterModuleStub();
	mock.module('$lib/server/rate-limiter', () => rateLimiterModuleStub);
	mock.module('$lib/server/rate-limiter.js', () => rateLimiterModuleStub);
	mock.module('$lib/server/audit', () => ({
		logAudit: async () => {}
	}));
	mock.module('$lib/server/logger.js', () => createLoggerModuleStub());

	const inMemory = setupInMemoryDb();
	state.db = inMemory.db;
	state.sqlite = inMemory.sqlite;

	POST = (await importFresh<PreferencesRouteModule>('../routes/api/v1/user/preferences/+server.js'))
		.POST;
});

afterEach(() => {
	state.sqlite?.close();
	state.sqlite = null;
	state.db = null;
	mock.restore();
});

describe('user preferences route', () => {
	test('updating one nested notifications field preserves sibling and onboarding fields', async () => {
		const db = state.db!;
		const initialPreferences: UserPreferences = {
			theme: 'system',
			notifications: {
				enabled: true,
				resourceTypes: ['Kustomization'],
				namespaces: ['team-a'],
				events: ['failure', 'warning']
			},
			onboarding: {
				adminChecklistDismissed: false,
				adminChecklistCompletedItems: ['clusters', 'settings']
			}
		};
		const user = createUser({ preferences: initialPreferences });

		db.insert(users).values(user).run();

		const response = await POST(buildEvent(user, { notifications: { enabled: false } }));
		expect(response.status).toBe(200);

		const body = (await response.json()) as {
			success: boolean;
			preferences: UserPreferences;
		};

		expect(body.success).toBe(true);
		expect(body.preferences.notifications?.enabled).toBe(false);
		expect(body.preferences.notifications?.namespaces).toEqual(['team-a']);
		expect(body.preferences.notifications?.resourceTypes).toEqual(['Kustomization']);
		expect(body.preferences.notifications?.events).toEqual(['failure', 'warning']);
		expect(body.preferences.onboarding).toEqual(initialPreferences.onboarding);
		expect(body.preferences.theme).toBe('system');

		const storedUser = await db.query.users.findFirst({
			where: eq(users.id, user.id),
			columns: { preferences: true }
		});
		expect(storedUser?.preferences).toEqual({
			theme: 'system',
			notifications: {
				enabled: false,
				resourceTypes: ['Kustomization'],
				namespaces: ['team-a'],
				events: ['failure', 'warning']
			},
			onboarding: {
				adminChecklistDismissed: false,
				adminChecklistCompletedItems: ['clusters', 'settings']
			}
		});
	});
});
