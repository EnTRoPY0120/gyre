import { logger } from '../logger.js';
import crypto from 'node:crypto';

/**
 * Get the encryption key for kubeconfigs from environment.
 * In production, this MUST be set via GYRE_ENCRYPTION_KEY env var.
 * For development, a default key is used.
 */
function getEncryptionKey(): string {
	const key = process.env.GYRE_ENCRYPTION_KEY;
	const isProd = process.env.NODE_ENV === 'production';

	if (!key) {
		if (isProd) {
			throw new Error(
				'GYRE_ENCRYPTION_KEY must be set in production! ' +
					'Please set it to a 64-character hexadecimal string.'
			);
		}
		const devKey = crypto.randomBytes(32).toString('hex');
		logger.warn(
			'⚠️  GYRE_ENCRYPTION_KEY not set! Using ephemeral random key. Encrypted kubeconfigs will be unreadable after restart. Set GYRE_ENCRYPTION_KEY to persist.'
		);
		return devKey;
	}

	// Validate key format (should be 64 hex characters = 32 bytes)
	if (!/^[0-9a-f]{64}$/i.test(key)) {
		throw new Error(
			'GYRE_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). Generate with: openssl rand -hex 32'
		);
	}

	return key;
}

let _encryptionKey: string | null = null;

function getEncryptionKeyLazy(): string {
	if (!_encryptionKey) {
		_encryptionKey = getEncryptionKey();
	}
	return _encryptionKey;
}

/**
 * Check if the encryption key is the insecure development default.
 */
export function isUsingDevelopmentKey(): boolean {
	return !process.env.GYRE_ENCRYPTION_KEY;
}

/**
 * Validate that encryption/decryption works correctly.
 */
export function testEncryption(): boolean {
	try {
		const testSecret = 'test-kubeconfig-' + crypto.randomUUID();
		const encrypted = encryptKubeconfig(testSecret);
		const decrypted = decryptKubeconfig(encrypted);
		return testSecret === decrypted;
	} catch {
		return false;
	}
}

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt kubeconfig string using AES-256-GCM
 * Format: v2:iv:ciphertext:authTag (all hex except v2 prefix)
 */
export function encryptKubeconfig(kubeconfig: string): string {
	const iv = crypto.randomBytes(16);
	const key = Buffer.from(getEncryptionKeyLazy(), 'hex'); // We validated it's 32 bytes hex

	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

	let encrypted = cipher.update(kubeconfig, 'utf8', 'hex');
	encrypted += cipher.final('hex');

	const authTag = cipher.getAuthTag();

	// Return format: v2:iv:ciphertext:authTag
	return `v2:${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

/**
 * Decrypt kubeconfig encrypted with legacy XOR cipher.
 * Used only by migrateKubeconfigs() to read pre-migration records.
 */
export function decryptLegacyXorKubeconfig(encrypted: string): string {
	const buffer = Buffer.from(encrypted, 'base64');
	const decrypted = Buffer.alloc(buffer.length);
	const key = getEncryptionKeyLazy();
	for (let i = 0; i < buffer.length; i++) {
		decrypted[i] = buffer[i] ^ key.charCodeAt(i % key.length);
	}
	return decrypted.toString('utf-8');
}

/**
 * Decrypt kubeconfig string.
 * Only AES-256-GCM (v2) format is supported.
 */
export function decryptKubeconfig(encrypted: string): string {
	// Check if it's the new v2 format
	if (encrypted.startsWith('v2:')) {
		const parts = encrypted.split(':');
		if (parts.length !== 4) {
			throw new Error('Invalid v2 encrypted kubeconfig format');
		}

		const [, ivHex, ciphertext, authTagHex] = parts;
		const key = Buffer.from(getEncryptionKeyLazy(), 'hex');
		const iv = Buffer.from(ivHex, 'hex');
		const authTag = Buffer.from(authTagHex, 'hex');

		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
		decrypted += decipher.final('utf8');
		return decrypted;
	}

	throw new Error(
		'Unsupported kubeconfig encryption format: only v2 (AES-256-GCM) is supported. ' +
			'Run migrateKubeconfigs() to upgrade any legacy records.'
	);
}

export { decryptKubeconfig as _decryptKubeconfig };
export function _resetEncryptionKeyCache(): void {
	_encryptionKey = null;
}
