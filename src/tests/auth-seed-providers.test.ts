import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest';
import { importFresh } from './helpers/import-fresh';
import { createAuthCryptoModuleStub, createLoggerModuleStub } from './helpers/module-stubs';

type SeedProvidersModule = typeof import('../lib/server/auth/seed-providers.js');

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

const originalEnv = {
	GYRE_AUTH_PROVIDERS: process.env.GYRE_AUTH_PROVIDERS,
	GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET: process.env.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET
};

let seedAuthProviders: SeedProvidersModule['seedAuthProviders'];

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

beforeEach(async () => {
	state.inserted = [];
	state.encryptInputs = [];
	state.warnLogs = [];
	state.errorLogs = [];
	state.infoLogs = [];

	const loggerModuleStub = createLoggerModuleStub();
	loggerModuleStub.logger.warn = (...args: [unknown, string] | [string]) => {
		state.warnLogs.push(args);
	};
	loggerModuleStub.logger.error = (...args: [unknown, string] | [string]) => {
		state.errorLogs.push(args);
	};
	loggerModuleStub.logger.info = (message: string) => {
		state.infoLogs.push(message);
	};

	vi.doMock('../lib/server/logger.js', () => loggerModuleStub);
	vi.doMock('../lib/server/auth/crypto', () =>
		createAuthCryptoModuleStub({
			encryptSecret: (value: string) => {
				state.encryptInputs.push(value);
				return createAuthCryptoModuleStub().encryptSecret(value);
			}
		})
	);
	vi.doMock('../lib/server/db', () => ({
		getDb: async () => buildDbMock()
	}));
	vi.doMock('../lib/server/db/schema', () => ({
		authProviders: {}
	}));

	seedAuthProviders = (
		await importFresh<SeedProvidersModule>('../lib/server/auth/seed-providers.js')
	).seedAuthProviders;
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

	vi.restoreAllMocks();
	vi.resetModules();
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

		const result = await seedAuthProviders();

		expect(result).toEqual({ created: 1, skipped: 0 });
		expect(state.encryptInputs).toEqual(['super-secret']);
		expect(state.inserted.length).toBe(1);
		expect(state.inserted[0].clientSecretEncrypted).not.toBe('super-secret');
	});

	test('throws when providers include forbidden clientSecret in JSON payload', async () => {
		process.env.GYRE_AUTH_PROVIDERS = JSON.stringify([
			{
				name: 'GitHub',
				type: 'oauth2-github',
				clientId: 'github-client-id',
				clientSecret: 'forbidden-inline-secret'
			}
		]);
		process.env.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET = 'super-secret';

		await expect(seedAuthProviders()).rejects.toThrow('forbidden inline clientSecret');
		expect(state.inserted.length).toBe(0);
	});

	test('throws when provider secret env var is missing', async () => {
		process.env.GYRE_AUTH_PROVIDERS = JSON.stringify([
			{
				name: 'GitHub',
				type: 'oauth2-github',
				clientId: 'github-client-id'
			}
		]);
		delete process.env.GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET;

		await expect(seedAuthProviders()).rejects.toThrow(
			'missing required env var GYRE_AUTH_PROVIDER_GITHUB_CLIENT_SECRET'
		);
		expect(state.inserted.length).toBe(0);
	});

	test('throws on malformed providers JSON', async () => {
		process.env.GYRE_AUTH_PROVIDERS = '{';

		await expect(seedAuthProviders()).rejects.toThrow();
		expect(state.inserted.length).toBe(0);
	});
});
