import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';

interface State {
	inserted: Record<string, unknown>[];
	encryptInputs: string[];
	warnLogs: Array<[unknown, string] | [string]>;
	errorLogs: Array<[unknown, string] | [string]>;
	infoLogs: string[];
}

const state: State = {
	inserted: [],
	encryptInputs: [],
	warnLogs: [],
	errorLogs: [],
	infoLogs: []
};

mock.module('../lib/server/logger.js', () => ({
	logger: {
		warn: (...args: [unknown, string] | [string]) => {
			state.warnLogs.push(args);
		},
		error: (...args: [unknown, string] | [string]) => {
			state.errorLogs.push(args);
		},
		info: (message: string) => {
			state.infoLogs.push(message);
		}
	}
}));

mock.module('../lib/server/auth/crypto.js', () => ({
	encryptSecret: (value: string) => {
		state.encryptInputs.push(value);
		return `enc:${value}`;
	}
}));

function buildDbMock() {
	return {
		transaction: (cb: (tx: any) => void) => {
			cb({
				insert: () => ({
					values: (provider: Record<string, unknown>) => ({
						onConflictDoNothing: () => ({
							returning: () => ({
								all: () => {
									state.inserted.push(provider);
									return [provider];
								}
							})
						})
					})
				})
			});
		}
	};
}

mock.module('../lib/server/db/index.js', () => ({
	getDb: async () => buildDbMock()
}));

mock.module('../lib/server/db.js', () => ({
	getDb: async () => buildDbMock()
}));

mock.module('../lib/server/db', () => ({
	getDb: async () => buildDbMock()
}));

mock.module('../lib/server/db/schema.js', () => ({
	authProviders: {}
}));

mock.module('../lib/server/db/schema', () => ({
	authProviders: {}
}));

const originalEnv = {
	GYRE_AUTH_PROVIDERS: process.env.GYRE_AUTH_PROVIDERS,
	GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET: process.env.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET
};

beforeEach(() => {
	state.inserted = [];
	state.encryptInputs = [];
	state.warnLogs = [];
	state.errorLogs = [];
	state.infoLogs = [];
});

afterEach(() => {
	if (originalEnv.GYRE_AUTH_PROVIDERS === undefined) delete process.env.GYRE_AUTH_PROVIDERS;
	else process.env.GYRE_AUTH_PROVIDERS = originalEnv.GYRE_AUTH_PROVIDERS;

	if (originalEnv.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET === undefined) {
		delete process.env.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET;
	} else {
		process.env.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET =
			originalEnv.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET;
	}
});

describe('seedAuthProviders', () => {
	test('seeds provider when metadata JSON is valid and env secret exists', async () => {
		process.env.GYRE_AUTH_PROVIDERS = JSON.stringify([
			{
				name: 'GitHub',
				type: 'oauth2-github',
				clientId: 'github-client-id'
			}
		]);
		process.env.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET = 'super-secret';

		const { seedAuthProviders } = await import('../lib/server/auth/seed-providers.js');
		const result = await seedAuthProviders();

		expect(result).toEqual({ created: 1, skipped: 0 });
		expect(state.encryptInputs).toEqual(['super-secret']);
		expect(state.inserted.length).toBe(1);
		expect(state.inserted[0].clientSecretEncrypted).toBe('enc:super-secret');
	});

	test('rejects providers that include forbidden clientSecret in JSON payload', async () => {
		process.env.GYRE_AUTH_PROVIDERS = JSON.stringify([
			{
				name: 'GitHub',
				type: 'oauth2-github',
				clientId: 'github-client-id',
				clientSecret: 'forbidden-inline-secret'
			}
		]);
		process.env.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET = 'super-secret';

		const { seedAuthProviders } = await import('../lib/server/auth/seed-providers.js');
		const result = await seedAuthProviders();

		expect(result).toEqual({ created: 0, skipped: 1 });
		expect(state.inserted.length).toBe(0);
		expect(state.warnLogs.length).toBeGreaterThan(0);
		expect(JSON.stringify(state.warnLogs)).toContain(
			'clientSecret: inline clientSecret is not allowed'
		);
	});

	test('skips provider with clear error when provider secret env var is missing', async () => {
		process.env.GYRE_AUTH_PROVIDERS = JSON.stringify([
			{
				name: 'GitHub',
				type: 'oauth2-github',
				clientId: 'github-client-id'
			}
		]);
		delete process.env.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET;

		const { seedAuthProviders } = await import('../lib/server/auth/seed-providers.js');
		const result = await seedAuthProviders();

		expect(result).toEqual({ created: 0, skipped: 1 });
		expect(state.inserted.length).toBe(0);
		expect(state.errorLogs.length).toBeGreaterThan(0);
		expect(JSON.stringify(state.errorLogs)).toContain(
			'missing required env var GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET'
		);
	});
});
