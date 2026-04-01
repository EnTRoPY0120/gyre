/**
 * Low-level AES-256-GCM primitives.
 * Key-agnostic — callers supply the key and handle their own key management.
 * Output is raw Buffers; callers choose how to serialize (hex string, binary, etc.).
 */

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV
const AUTH_TAG_LENGTH = 16; // 128-bit GCM auth tag

export interface AesGcmEncrypted {
	iv: Buffer;
	ciphertext: Buffer;
	authTag: Buffer;
}

/**
 * Encrypt arbitrary bytes with AES-256-GCM.
 * Generates a random IV on each call.
 */
export function aesGcmEncrypt(data: Buffer, key: Buffer): AesGcmEncrypted {
	const iv = crypto.randomBytes(IV_LENGTH);
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
	const authTag = cipher.getAuthTag();
	return { iv, ciphertext, authTag };
}

/**
 * Decrypt AES-256-GCM ciphertext.
 * Throws if the key is wrong or the data has been tampered with.
 */
export function aesGcmDecrypt(
	iv: Buffer,
	ciphertext: Buffer,
	authTag: Buffer,
	key: Buffer
): Buffer {
	const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
	decipher.setAuthTag(authTag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export { IV_LENGTH, AUTH_TAG_LENGTH };
