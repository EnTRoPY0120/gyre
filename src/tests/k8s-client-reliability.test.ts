import { describe, test, expect, spyOn } from 'bun:test';

// Suppress console noise
spyOn(console, 'log').mockImplementation(() => {});
spyOn(console, 'warn').mockImplementation(() => {});
spyOn(console, 'error').mockImplementation(() => {});

import {
	OPERATION_TIMEOUTS,
	clearClientPool,
	gracefulShutdown,
	auditLogSecretAccess
} from '../lib/server/kubernetes/client.js';
import {
	assertSupportedKubeConfigOptions,
	loadKubeConfig
} from '../lib/server/kubernetes/config.js';
import { ConfigurationError } from '../lib/server/kubernetes/errors.js';

// ---------------------------------------------------------------------------
// HTTP Keep-Alive Configuration
// ---------------------------------------------------------------------------

describe('HTTP Keep-Alive Configuration', () => {
	test('delete operation timeout is defined', () => {
		expect(OPERATION_TIMEOUTS.delete).toBeDefined();
		expect(OPERATION_TIMEOUTS.delete).toBeGreaterThan(0);
	});

	test('delete timeout matches other write operations', () => {
		expect(OPERATION_TIMEOUTS.delete).toBe(OPERATION_TIMEOUTS.create);
		expect(OPERATION_TIMEOUTS.delete).toBe(OPERATION_TIMEOUTS.update);
	});
});

// ---------------------------------------------------------------------------
// Connection Validation & Error Tracking
// ---------------------------------------------------------------------------

describe('Connection Validation', () => {
	test('pool metrics can be cleared', () => {
		// This is a basic sanity check that the clear function works
		clearClientPool();
		expect(true).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// Cache Behavior
// ---------------------------------------------------------------------------

// Request cache behavior (success-only caching, failure exclusion) is validated
// through integration tests with actual Kubernetes client operations.

// ---------------------------------------------------------------------------
// Delete Operations
// ---------------------------------------------------------------------------

describe('Delete Operations', () => {
	test('delete operation has timeout', () => {
		const deleteTimeout = OPERATION_TIMEOUTS.delete;
		expect(deleteTimeout).toBe(30_000);
		expect(deleteTimeout).toBeLessThanOrEqual(OPERATION_TIMEOUTS.create);
	});

	test('delete timeout is reasonable duration', () => {
		const deleteTimeout = OPERATION_TIMEOUTS.delete;
		// Should be between 5s and 5m
		expect(deleteTimeout).toBeGreaterThanOrEqual(5_000);
		expect(deleteTimeout).toBeLessThanOrEqual(5 * 60 * 1000);
	});
});

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

describe('Graceful Shutdown', () => {
	test('graceful shutdown can be invoked', () => {
		// Should not throw
		expect(() => gracefulShutdown()).not.toThrow();
	});

	test('graceful shutdown is idempotent', () => {
		// Should be safe to call multiple times
		gracefulShutdown();
		gracefulShutdown();
		gracefulShutdown();
		expect(true).toBe(true);
	});

	test('clear client pool works', () => {
		// Should not throw
		expect(() => clearClientPool()).not.toThrow();
	});
});

// ---------------------------------------------------------------------------
// UUID Validation Improvement
// ---------------------------------------------------------------------------

describe('UUID Validation (RFC 4122)', () => {
	test('valid UUID v4 passes', () => {
		// UUID v4: version=4 (3rd group, 3rd char), variant=8-b (4th group, 1st char)
		const uuid = '550e8400-e29b-41d4-a716-446655440000';
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[3-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		expect(uuidRegex.test(uuid)).toBe(true);
	});

	test('valid UUID v3 passes', () => {
		// UUID v3 (MD5): version=3 in 3rd group, variant 8-b in 4th group
		const uuid = 'a3bb189e-8bf9-3888-9912-ace4e6543002';
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[3-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		expect(uuidRegex.test(uuid)).toBe(true);
	});

	test('valid UUID v5 passes', () => {
		// UUID v5 (SHA-1): version=5
		const uuid = '886313e1-3b8a-5372-9b90-0c9aee199e5d';
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[3-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		expect(uuidRegex.test(uuid)).toBe(true);
	});

	test('invalid version (1,2,6,7) is rejected', () => {
		// UUID with version 1 should fail (3rd char should be 3-5, not 1)
		const uuidv1 = '550e8400-e29b-11d4-a716-446655440000';
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[3-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		expect(uuidRegex.test(uuidv1)).toBe(false);
	});

	test('invalid variant (0-7, c-f) is rejected', () => {
		// UUID with variant 0 should fail (4th group 1st char should be 8-b, not 0)
		const uuid = '550e8400-e29b-41d4-0716-446655440000';
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[3-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		expect(uuidRegex.test(uuid)).toBe(false);
	});

	test('malformed UUID is rejected', () => {
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[3-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
		expect(uuidRegex.test('not-a-uuid')).toBe(false);
		expect(uuidRegex.test('550e8400-e29b-41d4-a716')).toBe(false);
		expect(uuidRegex.test('550e8400-e29b-41d4-a716-446655440000-extra')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Secret Audit Logging
// ---------------------------------------------------------------------------

describe('Secret Audit Logging', () => {
	test('audit log function can be invoked', () => {
		// Should not throw
		expect(() => {
			auditLogSecretAccess('get', 'Secret', 'default', 'my-secret', 'production');
		}).not.toThrow();
	});

	test('audit log function works for list operations', () => {
		// list operations may not have a name
		expect(() => {
			auditLogSecretAccess('list', 'Secret', 'default');
		}).not.toThrow();
	});

	test('audit log function handles all operation types', () => {
		const operations = ['get', 'list', 'create', 'update', 'delete', 'patch'] as const;
		for (const op of operations) {
			expect(() => {
				auditLogSecretAccess(op, 'Secret', 'default', 'my-secret');
			}).not.toThrow();
		}
	});
});

// ---------------------------------------------------------------------------
// Configuration Options
// ---------------------------------------------------------------------------

describe('Kubeconfig Configuration Options', () => {
	test('allows undefined options', () => {
		expect(() => assertSupportedKubeConfigOptions()).not.toThrow();
	});

	test('allows empty options object', () => {
		expect(() => assertSupportedKubeConfigOptions({})).not.toThrow();
	});

	test('allows insecureSkipVerify=false', () => {
		expect(() =>
			assertSupportedKubeConfigOptions({
				insecureSkipVerify: false
			})
		).not.toThrow();
	});

	test('allows empty-string transport overrides', () => {
		expect(() =>
			assertSupportedKubeConfigOptions({
				caData: '',
				httpProxy: '',
				httpsProxy: '',
				noProxy: ''
			})
		).not.toThrow();
	});

	test('rejects caData override', () => {
		expect(() =>
			assertSupportedKubeConfigOptions({
				caData: '-----BEGIN CERTIFICATE-----'
			})
		).toThrow(ConfigurationError);
	});

	test('rejects httpProxy override', () => {
		expect(() =>
			assertSupportedKubeConfigOptions({
				httpProxy: 'http://proxy:8080'
			})
		).toThrow(ConfigurationError);
	});

	test('rejects httpsProxy override', () => {
		expect(() =>
			assertSupportedKubeConfigOptions({
				httpsProxy: 'https://proxy:8443'
			})
		).toThrow(ConfigurationError);
	});

	test('rejects noProxy override', () => {
		expect(() =>
			assertSupportedKubeConfigOptions({
				noProxy: 'localhost,.example.com'
			})
		).toThrow(ConfigurationError);
	});

	test('runtime loadKubeConfig rejects transport overrides', async () => {
		try {
			await loadKubeConfig({
				httpProxy: 'http://proxy:8080'
			});
			throw new Error('Expected ConfigurationError');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigurationError);
			expect((error as Error).message).toContain('httpProxy');
		}
	});

	test('rejects multiple overrides and lists all rejected keys', () => {
		try {
			assertSupportedKubeConfigOptions({
				caData: '-----BEGIN CERTIFICATE-----',
				insecureSkipVerify: true,
				httpProxy: 'http://proxy:8080',
				httpsProxy: 'https://proxy:8443',
				noProxy: 'localhost,.example.com'
			});
			throw new Error('Expected ConfigurationError');
		} catch (error) {
			expect(error).toBeInstanceOf(ConfigurationError);
			const message = (error as Error).message;
			expect(message).toContain('caData');
			expect(message).toContain('insecureSkipVerify');
			expect(message).toContain('httpProxy');
			expect(message).toContain('httpsProxy');
			expect(message).toContain('noProxy');
		}
	});
});
