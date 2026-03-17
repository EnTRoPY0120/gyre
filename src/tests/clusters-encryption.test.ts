import { describe, test, expect, afterEach } from 'bun:test';
import {
	testEncryption,
	isUsingDevelopmentKey,
	_decryptKubeconfig,
	_resetEncryptionKeyCache
} from '../lib/server/clusters';

describe('Cluster Kubeconfig Encryption', () => {
	const originalKey = process.env.GYRE_ENCRYPTION_KEY;
	afterEach(() => {
		if (originalKey !== undefined) {
			process.env.GYRE_ENCRYPTION_KEY = originalKey;
		} else {
			delete process.env.GYRE_ENCRYPTION_KEY;
		}
		_resetEncryptionKeyCache();
	});

	describe('testEncryption()', () => {
		test('returns true when encryption subsystem is working', () => {
			expect(testEncryption()).toBe(true);
		});
	});

	describe('isUsingDevelopmentKey()', () => {
		test('returns true when GYRE_ENCRYPTION_KEY is not set', () => {
			delete process.env.GYRE_ENCRYPTION_KEY;
			expect(isUsingDevelopmentKey()).toBe(true);
		});
		test('returns false when GYRE_ENCRYPTION_KEY is set', () => {
			process.env.GYRE_ENCRYPTION_KEY = 'a'.repeat(64);
			expect(isUsingDevelopmentKey()).toBe(false);
		});
	});

	describe('_decryptKubeconfig — v2 format', () => {
		test('throws on invalid v2 string (wrong number of colons)', () => {
			expect(() => _decryptKubeconfig('v2:abc:def')).toThrow(
				'Invalid v2 encrypted kubeconfig format'
			);
		});
	});

	describe('_decryptKubeconfig — XOR format rejection', () => {
		test('throws when given a non-v2 prefixed string', () => {
			const legacyXor = Buffer.from('fake-xor-data').toString('base64');
			expect(() => _decryptKubeconfig(legacyXor)).toThrow(
				'Unsupported kubeconfig encryption format'
			);
		});
		test('error message mentions v2', () => {
			expect(() => _decryptKubeconfig('not-v2')).toThrow('v2');
		});
	});
});
