import { describe, expect, test } from 'vitest';
import { validateProductionSecurityConfig } from '../lib/server/security-config.js';

function validProductionEnv(): Record<string, string | undefined> {
	return {
		NODE_ENV: 'production',
		BACKUP_ENCRYPTION_KEY: 'a'.repeat(64),
		AUTH_ENCRYPTION_KEY: 'b'.repeat(64),
		GYRE_ENCRYPTION_KEY: 'c'.repeat(64),
		BETTER_AUTH_SECRET: 'better-auth-secret-with-enough-entropy',
		GYRE_METRICS_TOKEN: 'metrics-token'
	};
}

describe('validateProductionSecurityConfig', () => {
	test('allows missing BACKUP_ENCRYPTION_KEY and GYRE_METRICS_TOKEN in development', () => {
		expect(() =>
			validateProductionSecurityConfig({
				NODE_ENV: 'development'
			})
		).not.toThrow();
	});

	test('fails in production when BACKUP_ENCRYPTION_KEY is missing', () => {
		const env = validProductionEnv();
		delete env.BACKUP_ENCRYPTION_KEY;

		expect(() => validateProductionSecurityConfig(env)).toThrow(
			'BACKUP_ENCRYPTION_KEY must be set in production!'
		);
	});

	test('fails in production when BACKUP_ENCRYPTION_KEY format is invalid', () => {
		const env = {
			...validProductionEnv(),
			BACKUP_ENCRYPTION_KEY: 'not-a-hex-key'
		};

		expect(() => validateProductionSecurityConfig(env)).toThrow(
			'BACKUP_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). Generate with: openssl rand -hex 32'
		);
	});

	test('fails in production when GYRE_METRICS_TOKEN is missing', () => {
		const env = validProductionEnv();
		delete env.GYRE_METRICS_TOKEN;

		expect(() => validateProductionSecurityConfig(env)).toThrow(
			'GYRE_METRICS_TOKEN must be set in production!'
		);
	});

	test('fails in production when BETTER_AUTH_SECRET is missing', () => {
		const env = validProductionEnv();
		delete env.BETTER_AUTH_SECRET;

		expect(() => validateProductionSecurityConfig(env)).toThrow(
			'BETTER_AUTH_SECRET must be set in production!'
		);
	});

	test('fails in production when BETTER_AUTH_SECRET is too short', () => {
		const env = {
			...validProductionEnv(),
			BETTER_AUTH_SECRET: 'short-secret'
		};

		expect(() => validateProductionSecurityConfig(env)).toThrow(
			'BETTER_AUTH_SECRET must be at least 32 characters in production!'
		);
	});

	test.each(['AUTH_ENCRYPTION_KEY', 'GYRE_ENCRYPTION_KEY', 'BACKUP_ENCRYPTION_KEY'])(
		'fails in production when BETTER_AUTH_SECRET matches %s',
		(secretName) => {
			const env = validProductionEnv();
			env.BETTER_AUTH_SECRET = env[secretName as keyof ReturnType<typeof validProductionEnv>];

			expect(() => validateProductionSecurityConfig(env)).toThrow(
				`BETTER_AUTH_SECRET must be distinct from ${secretName} in production!`
			);
		}
	);

	test('passes in production when required secrets are distinct', () => {
		expect(() => validateProductionSecurityConfig(validProductionEnv())).not.toThrow();
	});
});
