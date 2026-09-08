import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import * as schema from '../lib/server/db/schema.js';
import { buildOAuthAccountData } from '../lib/server/auth/oauth-account.js';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, test } from 'vitest';
import { initAuthTables } from '../lib/server/db/migrations/auth-tables.js';

const flags = {
	hasLegacyUserProviders: false,
	hasLegacyPasswordHashColumn: false,
	hasNullableSessionToken: false
};

describe('Better Auth account issuer migration', () => {
	test('backfills existing accounts, preserves password login, and supports OAuth linking', async () => {
		const sqlite = new Database(':memory:');
		try {
			const db = drizzle(sqlite);
			initAuthTables(db, flags);
			// Recreate the pre-1.7 accounts schema from the initialized table.
			const columns = sqlite.prepare('PRAGMA table_info(accounts)').all() as { name: string }[];
			if (columns.some((column) => column.name === 'issuer')) {
				sqlite.exec('DROP INDEX IF EXISTS idx_accounts_issuer_account');
				sqlite.exec('ALTER TABLE accounts DROP COLUMN issuer');
			}
			sqlite.exec(`
				INSERT INTO users (id, username, email) VALUES ('u1', 'alice', 'alice@example.com');
				INSERT INTO accounts (id, provider_id, account_id, user_id, password)
				VALUES ('password', 'credential', 'u1', 'u1', 'existing-hash');
				INSERT INTO accounts (id, provider_id, account_id, user_id)
				VALUES ('oauth', 'company/oidc', 'subject-1', 'u1');
			`);
			initAuthTables(db, flags);
			initAuthTables(db, flags);
			expect(sqlite.prepare('SELECT id, issuer, password FROM accounts ORDER BY id').all()).toEqual(
				[
					{ id: 'oauth', issuer: 'local:oauth:company%2Foidc', password: null },
					{ id: 'password', issuer: 'local:credential', password: 'existing-hash' }
				]
			);
			const auth = betterAuth({
				baseURL: 'http://localhost:3000',
				secret: 'test-account-issuer-migration-secret-12345',
				database: drizzleAdapter(drizzle(sqlite, { schema }), { provider: 'sqlite', schema }),
				user: { modelName: 'users' },
				session: { modelName: 'sessions' },
				account: { modelName: 'accounts' },
				verification: { modelName: 'verifications' },
				emailAndPassword: {
					enabled: true,
					password: {
						hash: async (password) => password,
						verify: async ({ hash, password }) => hash === password
					}
				}
			});
			const login = await auth.api.signInEmail({
				body: { email: 'alice@example.com', password: 'existing-hash' }
			});
			expect(login.user.id).toBe('u1');
			expect(login.token).toBeTruthy();
			const ctx = await auth.$context;
			const account = buildOAuthAccountData('u1', 'other/oidc', 'subject-2', undefined, undefined);
			await ctx.internalAdapter.linkAccount(account);
			const linked = await ctx.internalAdapter.findAccountByKey({
				issuer: 'local:oauth:other%2Foidc',
				accountId: 'subject-2'
			});
			expect(linked?.userId).toBe('u1');
		} finally {
			sqlite.close();
		}
	});
});
