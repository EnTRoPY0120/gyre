import { logger } from '../logger.js';
import crypto from 'node:crypto';
import { aesGcmEncrypt, aesGcmDecrypt } from '../aes-gcm.js';

/**
 * Encryption utilities for securing OAuth client secrets at rest.
 * Uses AES-256-GCM for authenticated encryption.
 */

const KEY_LENGTH = 32; // 256 bits

/**
 * Get or generate the encryption key from environment.
 * In production, this MUST be set via AUTH_ENCRYPTION_KEY env var.
 * For development, a default key is generated (NOT secure for production).
 */
function getEncryptionKey(): Buffer {
	const keyHex = process.env.AUTH_ENCRYPTION_KEY;
	const isProd = process.env.NODE_ENV === 'production';

	if (!keyHex) {
		if (isProd) {
			throw new Error(
				'AUTH_ENCRYPTION_KEY must be set in production! ' +
					'Please set it to a 64-character hexadecimal string.'
			);
		}
		logger.warn(
			'⚠️  AUTH_ENCRYPTION_KEY not set! Using ephemeral random key. OAuth secrets will be unreadable after restart. Set AUTH_ENCRYPTION_KEY to persist.'
		);
		return crypto.randomBytes(KEY_LENGTH);
	}

	// Validate key format (should be 64 hex characters = 32 bytes)
	if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
		throw new Error(
			'AUTH_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). Generate with: openssl rand -hex 32'
		);
	}

	return Buffer.from(keyHex, 'hex');
}

let _authEncryptionKey: Buffer | null = null;

/**
 * Internal for testing: Clear the cached encryption key.
 * This ensures changes to AUTH_ENCRYPTION_KEY in environment are picked up.
 */
export function _resetKeyCache(): void {
	_authEncryptionKey = null;
}

function getAuthEncryptionKeyLazy(): Buffer {
	if (!_authEncryptionKey) {
		_authEncryptionKey = getEncryptionKey();
	}
	return _authEncryptionKey;
}

/**
 * Generate a random encryption key suitable for AUTH_ENCRYPTION_KEY.
 * @returns 64 hex characters (32 bytes)
 */
export function generateEncryptionKey(): string {
	return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Encrypt a plaintext secret (e.g., OAuth client secret).
 * Returns a string in format: iv:encrypted:authTag (all hex-encoded)
 *
 * @param plaintext - The secret to encrypt
 * @returns Encrypted string in format "iv:ciphertext:authTag"
 */
export function encryptSecret(plaintext: string): string {
	const key = getAuthEncryptionKeyLazy();
	const { iv, ciphertext, authTag } = aesGcmEncrypt(Buffer.from(plaintext, 'utf8'), key);
	// Return format: iv:ciphertext:authTag (all hex)
	return `${iv.toString('hex')}:${ciphertext.toString('hex')}:${authTag.toString('hex')}`;
}

/**
 * Decrypt an encrypted secret.
 * Expects input in format: iv:encrypted:authTag (all hex-encoded)
 *
 * @param ciphertext - The encrypted string from encryptSecret()
 * @returns Decrypted plaintext secret
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 */
export function decryptSecret(ciphertext: string): string {
	const key = getAuthEncryptionKeyLazy();

	// Parse the encrypted format: iv:ciphertext:authTag (all hex)
	const parts = ciphertext.split(':');
	if (parts.length !== 3) {
		throw new Error('Invalid encrypted secret format. Expected: iv:ciphertext:authTag');
	}

	const [ivHex, encryptedHex, authTagHex] = parts;
	try {
		const decrypted = aesGcmDecrypt(
			Buffer.from(ivHex, 'hex'),
			Buffer.from(encryptedHex, 'hex'),
			Buffer.from(authTagHex, 'hex'),
			key
		);
		return decrypted.toString('utf8');
	} catch {
		throw new Error('Failed to decrypt secret. Incorrect key or tampered data.');
	}
}

/**
 * Check if the encryption key is the insecure development default.
 * Use this to warn users in production environments.
 */
export function isUsingDevelopmentKey(): boolean {
	return !process.env.AUTH_ENCRYPTION_KEY;
}

/**
 * Validate that encryption/decryption works correctly.
 * Useful for startup checks.
 */
export function testEncryption(): boolean {
	try {
		const testSecret = 'test-secret-' + crypto.randomBytes(8).toString('hex');
		const encrypted = encryptSecret(testSecret);
		const decrypted = decryptSecret(encrypted);
		return testSecret === decrypted;
	} catch {
		return false;
	}
}
