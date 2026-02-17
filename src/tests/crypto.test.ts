import { describe, test, expect, afterEach } from 'bun:test';
import {
	encryptSecret,
	decryptSecret,
	generateEncryptionKey,
	isUsingDevelopmentKey,
	testEncryption
} from '../lib/server/auth/crypto';

describe('Encryption Module', () => {
	const originalEnv = process.env.AUTH_ENCRYPTION_KEY;
	const originalNodeEnv = process.env.NODE_ENV;

	afterEach(() => {
		// Restore original env vars after each test
		if (originalEnv !== undefined) {
			process.env.AUTH_ENCRYPTION_KEY = originalEnv;
		} else {
			delete process.env.AUTH_ENCRYPTION_KEY;
		}
		if (originalNodeEnv !== undefined) {
			process.env.NODE_ENV = originalNodeEnv;
		} else {
			delete process.env.NODE_ENV;
		}
	});

	describe('generateEncryptionKey', () => {
		test('generates a 64 character hex string (32 bytes)', () => {
			const key = generateEncryptionKey();
			expect(key).toHaveLength(64);
			expect(key).toMatch(/^[0-9a-f]{64}$/);
		});

		test('generates unique keys each time', () => {
			const key1 = generateEncryptionKey();
			const key2 = generateEncryptionKey();
			expect(key1).not.toBe(key2);
		});
	});

	describe('encryptSecret / decryptSecret round-trip', () => {
		test('encrypts and decrypts a simple string', () => {
			const plaintext = 'my-client-secret-123';
			const encrypted = encryptSecret(plaintext);
			const decrypted = decryptSecret(encrypted);
			expect(decrypted).toBe(plaintext);
		});

		test('encrypts and decrypts an empty string', () => {
			const plaintext = '';
			const encrypted = encryptSecret(plaintext);
			const decrypted = decryptSecret(encrypted);
			expect(decrypted).toBe(plaintext);
		});

		test('encrypts and decrypts unicode content', () => {
			const plaintext = '密码🔐안녕하세요';
			const encrypted = encryptSecret(plaintext);
			const decrypted = decryptSecret(encrypted);
			expect(decrypted).toBe(plaintext);
		});

		test('encrypts and decrypts a long secret', () => {
			const plaintext = 'x'.repeat(10000);
			const encrypted = encryptSecret(plaintext);
			const decrypted = decryptSecret(encrypted);
			expect(decrypted).toBe(plaintext);
		});

		test('produces different ciphertext for the same input (unique IV)', () => {
			const plaintext = 'same-secret';
			const encrypted1 = encryptSecret(plaintext);
			const encrypted2 = encryptSecret(plaintext);
			expect(encrypted1).not.toBe(encrypted2);
		});

		test('ciphertext is in iv:ciphertext:authTag format', () => {
			const encrypted = encryptSecret('test');
			const parts = encrypted.split(':');
			expect(parts).toHaveLength(3);
			// IV should be 32 hex chars (16 bytes)
			expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
			// Auth tag should be 32 hex chars (16 bytes)
			expect(parts[2]).toMatch(/^[0-9a-f]{32}$/);
		});
	});

	describe('auth tag validation (tamper detection)', () => {
		test('throws on tampered ciphertext', () => {
			const encrypted = encryptSecret('sensitive-data');
			const parts = encrypted.split(':');
			// Flip a character in the ciphertext portion
			const tampered = parts[0] + ':' + 'ff' + parts[1].slice(2) + ':' + parts[2];
			expect(() => decryptSecret(tampered)).toThrow();
		});

		test('throws on tampered auth tag', () => {
			const encrypted = encryptSecret('sensitive-data');
			const parts = encrypted.split(':');
			const tamperedTag = '0'.repeat(32);
			const tampered = parts[0] + ':' + parts[1] + ':' + tamperedTag;
			expect(() => decryptSecret(tampered)).toThrow();
		});

		test('throws on tampered IV', () => {
			const encrypted = encryptSecret('sensitive-data');
			const parts = encrypted.split(':');
			const tamperedIv = '0'.repeat(32);
			const tampered = tamperedIv + ':' + parts[1] + ':' + parts[2];
			expect(() => decryptSecret(tampered)).toThrow();
		});
	});

	describe('invalid input handling', () => {
		test('throws on malformed ciphertext (missing parts)', () => {
			expect(() => decryptSecret('only-one-part')).toThrow(
				'Invalid encrypted secret format'
			);
		});

		test('throws on malformed ciphertext (too many parts)', () => {
			expect(() => decryptSecret('a:b:c:d')).toThrow(
				'Invalid encrypted secret format'
			);
		});
	});

	describe('isUsingDevelopmentKey', () => {
		test('returns true when AUTH_ENCRYPTION_KEY is not set', () => {
			delete process.env.AUTH_ENCRYPTION_KEY;
			expect(isUsingDevelopmentKey()).toBe(true);
		});

		test('returns false when AUTH_ENCRYPTION_KEY is set', () => {
			process.env.AUTH_ENCRYPTION_KEY = 'a'.repeat(64);
			expect(isUsingDevelopmentKey()).toBe(false);
		});
	});

	describe('testEncryption', () => {
		test('returns true when encryption subsystem is working', () => {
			expect(testEncryption()).toBe(true);
		});
	});
});
