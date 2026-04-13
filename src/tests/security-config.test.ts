import { afterEach, describe, expect, test } from 'bun:test';
import { validateProductionSecurityConfig } from '../lib/server/security-config.js';

const originalEnv = {
	NODE_ENV: process.env.NODE_ENV,
	BACKUP_ENCRYPTION_KEY: process.env.BACKUP_ENCRYPTION_KEY,
	GYRE_METRICS_TOKEN: process.env.GYRE_METRICS_TOKEN
};

afterEach(() => {
	if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = originalEnv.NODE_ENV;

	if (originalEnv.BACKUP_ENCRYPTION_KEY === undefined) delete process.env.BACKUP_ENCRYPTION_KEY;
	else process.env.BACKUP_ENCRYPTION_KEY = originalEnv.BACKUP_ENCRYPTION_KEY;

	if (originalEnv.GYRE_METRICS_TOKEN === undefined) delete process.env.GYRE_METRICS_TOKEN;
	else process.env.GYRE_METRICS_TOKEN = originalEnv.GYRE_METRICS_TOKEN;
});

describe('validateProductionSecurityConfig', () => {
	test('allows missing BACKUP_ENCRYPTION_KEY and GYRE_METRICS_TOKEN in development', () => {
		process.env.NODE_ENV = 'development';
		delete process.env.BACKUP_ENCRYPTION_KEY;
		delete process.env.GYRE_METRICS_TOKEN;

		expect(() => validateProductionSecurityConfig()).not.toThrow();
	});

	test('fails in production when BACKUP_ENCRYPTION_KEY is missing', () => {
		process.env.NODE_ENV = 'production';
		delete process.env.BACKUP_ENCRYPTION_KEY;
		process.env.GYRE_METRICS_TOKEN = 'metrics-token';

		expect(() => validateProductionSecurityConfig()).toThrow(
			'BACKUP_ENCRYPTION_KEY must be set in production!'
		);
	});

	test('fails in production when BACKUP_ENCRYPTION_KEY format is invalid', () => {
		process.env.NODE_ENV = 'production';
		process.env.BACKUP_ENCRYPTION_KEY = 'not-a-hex-key';
		process.env.GYRE_METRICS_TOKEN = 'metrics-token';

		expect(() => validateProductionSecurityConfig()).toThrow(
			'BACKUP_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). Generate with: openssl rand -hex 32'
		);
	});

	test('fails in production when GYRE_METRICS_TOKEN is missing', () => {
		process.env.NODE_ENV = 'production';
		process.env.BACKUP_ENCRYPTION_KEY = 'a'.repeat(64);
		delete process.env.GYRE_METRICS_TOKEN;

		expect(() => validateProductionSecurityConfig()).toThrow(
			'GYRE_METRICS_TOKEN must be set in production!'
		);
	});

	test('passes in production when BACKUP_ENCRYPTION_KEY and GYRE_METRICS_TOKEN are configured', () => {
		process.env.NODE_ENV = 'production';
		process.env.BACKUP_ENCRYPTION_KEY = 'a'.repeat(64);
		process.env.GYRE_METRICS_TOKEN = 'metrics-token';

		expect(() => validateProductionSecurityConfig()).not.toThrow();
	});
});
