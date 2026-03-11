import { describe, test, expect, afterEach } from 'bun:test';
import crypto from 'node:crypto';
import {
	_encryptBackup,
	_decryptBackup,
	_getBackupEncryptionKey,
	BackupError
} from '../lib/server/backup';

const KEY_LENGTH = 32;

function makeKey(): Buffer {
	return crypto.randomBytes(KEY_LENGTH);
}

describe('Backup Encryption Module', () => {
	const originalEnv = process.env.BACKUP_ENCRYPTION_KEY;

	afterEach(() => {
		if (originalEnv !== undefined) {
			process.env.BACKUP_ENCRYPTION_KEY = originalEnv;
		} else {
			delete process.env.BACKUP_ENCRYPTION_KEY;
		}
	});

	describe('_encryptBackup / _decryptBackup round-trip', () => {
		test('encrypts and decrypts arbitrary bytes back to original', () => {
			const key = makeKey();
			const data = Buffer.from('Hello, SQLite backup!');
			const encrypted = _encryptBackup(data, key);
			const decrypted = _decryptBackup(encrypted, key);
			expect(decrypted).toEqual(data);
		});

		test('handles empty buffer', () => {
			const key = makeKey();
			const data = Buffer.alloc(0);
			const encrypted = _encryptBackup(data, key);
			const decrypted = _decryptBackup(encrypted, key);
			expect(decrypted).toEqual(data);
		});

		test('handles large buffer (1 MB)', () => {
			const key = makeKey();
			const data = crypto.randomBytes(1024 * 1024);
			const encrypted = _encryptBackup(data, key);
			const decrypted = _decryptBackup(encrypted, key);
			expect(decrypted).toEqual(data);
		});

		test('produces different ciphertext for the same input (unique IV each call)', () => {
			const key = makeKey();
			const data = Buffer.from('same payload');
			const enc1 = _encryptBackup(data, key);
			const enc2 = _encryptBackup(data, key);
			expect(enc1).not.toEqual(enc2);
		});

		test('encrypted output is larger than input (IV + authTag overhead)', () => {
			const key = makeKey();
			const data = Buffer.from('payload');
			const encrypted = _encryptBackup(data, key);
			// 16-byte IV + 16-byte authTag = 32 bytes overhead
			expect(encrypted.length).toBe(data.length + 32);
		});
	});

	describe('tamper detection (GCM auth tag)', () => {
		test('throws BackupError when ciphertext is tampered', () => {
			const key = makeKey();
			const data = Buffer.from('sensitive data');
			const encrypted = _encryptBackup(data, key);
			// Flip a byte in the ciphertext portion (after 32-byte IV+authTag header)
			encrypted[33] ^= 0xff;
			expect(() => _decryptBackup(encrypted, key)).toThrow(BackupError);
		});

		test('throws BackupError when auth tag is tampered', () => {
			const key = makeKey();
			const data = Buffer.from('sensitive data');
			const encrypted = _encryptBackup(data, key);
			// Auth tag is bytes 16–31
			encrypted[16] ^= 0xff;
			expect(() => _decryptBackup(encrypted, key)).toThrow(BackupError);
		});

		test('throws BackupError when IV is tampered', () => {
			const key = makeKey();
			const data = Buffer.from('sensitive data');
			const encrypted = _encryptBackup(data, key);
			// IV is bytes 0–15
			encrypted[0] ^= 0xff;
			expect(() => _decryptBackup(encrypted, key)).toThrow(BackupError);
		});
	});

	describe('wrong key rejection', () => {
		test('throws BackupError when decrypting with a different key', () => {
			const key1 = makeKey();
			const key2 = makeKey();
			const data = Buffer.from('secret backup data');
			const encrypted = _encryptBackup(data, key1);
			expect(() => _decryptBackup(encrypted, key2)).toThrow(BackupError);
		});
	});

	describe('invalid input handling', () => {
		test('throws BackupError when encrypted buffer is too small', () => {
			const key = makeKey();
			// Must be at least 32 bytes (IV + authTag); 10 bytes is too small
			const tooSmall = Buffer.alloc(10);
			expect(() => _decryptBackup(tooSmall, key)).toThrow(BackupError);
		});
	});

	describe('_getBackupEncryptionKey', () => {
		test('returns null when BACKUP_ENCRYPTION_KEY is not set', () => {
			delete process.env.BACKUP_ENCRYPTION_KEY;
			expect(_getBackupEncryptionKey()).toBeNull();
		});

		test('returns a 32-byte Buffer for a valid 64-char hex key', () => {
			process.env.BACKUP_ENCRYPTION_KEY = 'a'.repeat(64);
			const key = _getBackupEncryptionKey();
			expect(key).not.toBeNull();
			expect(key!.length).toBe(32);
		});

		test('throws for a key that is too short', () => {
			process.env.BACKUP_ENCRYPTION_KEY = 'a'.repeat(32); // only 32 hex chars
			expect(() => _getBackupEncryptionKey()).toThrow('BACKUP_ENCRYPTION_KEY');
		});

		test('throws for a key with non-hex characters', () => {
			process.env.BACKUP_ENCRYPTION_KEY = 'z'.repeat(64);
			expect(() => _getBackupEncryptionKey()).toThrow('BACKUP_ENCRYPTION_KEY');
		});

		test('accepts uppercase hex', () => {
			process.env.BACKUP_ENCRYPTION_KEY = 'A'.repeat(64);
			const key = _getBackupEncryptionKey();
			expect(key).not.toBeNull();
			expect(key!.length).toBe(32);
		});
	});
});
