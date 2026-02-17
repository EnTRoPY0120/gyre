import crypto from 'node:crypto';

/**
 * Encryption utilities for securing OAuth client secrets at rest.
 * Uses AES-256-GCM for authenticated encryption.
 */

const ALGORITHM = 'aes-256-gcm';
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
		console.warn(
			'⚠️  AUTH_ENCRYPTION_KEY not set! Using development-only key. DO NOT USE IN PRODUCTION!'
		);
		// Development-only default key (NOT SECURE)
		const devKey = 'dev-key-not-secure-change-in-production-0123456789abcdef'.slice(0, 64);
		return Buffer.from(devKey, 'utf-8').subarray(0, KEY_LENGTH);
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
	const iv = crypto.randomBytes(16); // 128-bit IV for GCM

	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(plaintext, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const authTag = cipher.getAuthTag();

	// Return format: iv:ciphertext:authTag (all hex)
	return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
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

	// Parse the encrypted format
	const parts = ciphertext.split(':');
	if (parts.length !== 3) {
		throw new Error('Invalid encrypted secret format. Expected: iv:ciphertext:authTag');
	}

	const [ivHex, encrypted, authTagHex] = parts;

	const iv = Buffer.from(ivHex, 'hex');
	const authTag = Buffer.from(authTagHex, 'hex');

	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);

	let decrypted: string;
	try {
		decrypted = decipher.update(encrypted, 'hex', 'utf8');
		decrypted += decipher.final('utf8');
	} catch {
		throw new Error('Failed to decrypt secret. Incorrect key or tampered data.');
	}

	return decrypted;
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
