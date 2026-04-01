/**
 * Database Backup Service
 * Handles creating, listing, and restoring SQLite database backups.
 * Supports AES-256-GCM encryption at rest when BACKUP_ENCRYPTION_KEY is set.
 */

import { logger } from './logger.js';
import {
	existsSync,
	mkdirSync,
	readdirSync,
	statSync,
	unlinkSync,
	copyFileSync,
	writeFileSync,
	readFileSync,
	renameSync
} from 'node:fs';
import { join, basename } from 'node:path';
import { validateDatabaseUrl } from './db/path-validation.js';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import { aesGcmEncrypt, aesGcmDecrypt, IV_LENGTH, AUTH_TAG_LENGTH } from './aes-gcm.js';

import { MAX_LOCAL_BACKUPS } from './config/constants.js';
import { closeDb } from './db/index.js';

const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;
const databaseUrl = process.env.DATABASE_URL || (isInCluster ? '/data/gyre.db' : './data/gyre.db');
const backupDir = process.env.BACKUP_DIR || (isInCluster ? '/data/backups' : './data/backups');

if (process.env.DATABASE_URL) {
	validateDatabaseUrl(databaseUrl);
}

/**
 * Canonical backup filename pattern.
 * Matches exactly the format produced by createBackup():
 *   gyre-backup-YYYY-MM-DDThh-mm-ss-mmmZ.db[.enc]
 */
export const BACKUP_FILENAME_RE =
	/^gyre-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.db(\.enc)?$/;

/**
 * Custom error for backup operations with HTTP status support
 */
export class BackupError extends Error {
	constructor(
		message: string,
		public status: number = 500
	) {
		super(message);
		this.name = 'BackupError';
	}
}

export interface BackupMetadata {
	filename: string;
	sizeBytes: number;
	createdAt: string;
	encrypted: boolean;
}

let cachedEncryptionKey: Buffer | null | undefined = undefined;
let hasWarnedUnencrypted = false;

/**
 * Get the backup encryption key from BACKUP_ENCRYPTION_KEY env var.
 * Returns null if not set (encryption disabled).
 * Throws if the key format is invalid.
 *
 * NOTE: Changing BACKUP_ENCRYPTION_KEY will render all existing encrypted
 * backups (.db.enc) unreadable. There is no automatic key rotation — if you
 * rotate the key, decrypt and re-encrypt existing backups manually first.
 */
function getBackupEncryptionKey(): Buffer | null {
	if (cachedEncryptionKey !== undefined) return cachedEncryptionKey;
	const keyHex = process.env.BACKUP_ENCRYPTION_KEY;
	if (!keyHex) {
		cachedEncryptionKey = null;
		return cachedEncryptionKey;
	}
	if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
		throw new BackupError(
			'BACKUP_ENCRYPTION_KEY must be 64 hexadecimal characters (32 bytes). ' +
				'Generate with: openssl rand -hex 32'
		);
	}
	cachedEncryptionKey = Buffer.from(keyHex, 'hex');
	return cachedEncryptionKey;
}

/**
 * Encrypt a backup buffer using AES-256-GCM.
 * Output binary format: [16-byte IV][16-byte authTag][ciphertext]
 */
function encryptBackup(data: Buffer, key: Buffer): Buffer {
	const { iv, ciphertext, authTag } = aesGcmEncrypt(data, key);
	return Buffer.concat([iv, authTag, ciphertext]);
}

/**
 * Decrypt an encrypted backup buffer.
 * Expects binary format: [16-byte IV][16-byte authTag][ciphertext]
 */
function decryptBackup(data: Buffer, key: Buffer): Buffer {
	const minLength = IV_LENGTH + AUTH_TAG_LENGTH;
	if (data.length < minLength) {
		throw new BackupError('Invalid encrypted backup: file too small', 400);
	}

	const iv = data.subarray(0, IV_LENGTH);
	const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

	try {
		return aesGcmDecrypt(iv, ciphertext, authTag, key);
	} catch {
		throw new BackupError('Failed to decrypt backup: incorrect key or tampered data.', 400);
	}
}

/**
 * Ensure the backup directory exists.
 */
function ensureBackupDir(): void {
	if (!existsSync(backupDir)) {
		mkdirSync(backupDir, { recursive: true });
	}
}

/**
 * Create a database backup using SQLite's online backup API for atomicity.
 * If BACKUP_ENCRYPTION_KEY is set, the backup is encrypted with AES-256-GCM
 * and saved as a .db.enc file. Otherwise an unencrypted .db file is created.
 * Returns metadata about the created backup.
 */
export async function createBackup(): Promise<BackupMetadata> {
	ensureBackupDir();

	const now = new Date();
	const ts = now.toISOString().replace(/[:.]/g, '-');
	const key = getBackupEncryptionKey();

	if (key) {
		// Write plain SQLite to a temp file outside backupDir so the plaintext
		// is never resident in the backup directory even on failure.
		const tempPath = join(tmpdir(), `gyre-backup-temp-${ts}.db`);
		const encFilename = `gyre-backup-${ts}.db.enc`;
		const encPath = join(backupDir, encFilename);

		const source = new Database(databaseUrl);
		try {
			await source.backup(tempPath);
			const plainData = readFileSync(tempPath);
			const encData = encryptBackup(plainData, key);
			// Write to a temp file first, then rename atomically to prevent corrupt partial files
			const tempEncPath = `${encPath}.tmp`;
			writeFileSync(tempEncPath, encData);
			renameSync(tempEncPath, encPath);
		} finally {
			source.close();
			if (existsSync(tempPath)) unlinkSync(tempPath);
		}

		pruneOldBackups();

		const stat = statSync(encPath);
		return {
			filename: encFilename,
			sizeBytes: stat.size,
			createdAt: now.toISOString(),
			encrypted: true
		};
	} else {
		// Unencrypted backup (BACKUP_ENCRYPTION_KEY not set)
		if (!hasWarnedUnencrypted) {
			logger.warn(
				'[Backup] ⚠️  BACKUP_ENCRYPTION_KEY is not set. Creating unencrypted backup. ' +
					'Set BACKUP_ENCRYPTION_KEY to a 64-character hex string to enable encryption at rest.'
			);
			hasWarnedUnencrypted = true;
		}

		const filename = `gyre-backup-${ts}.db`;
		const destPath = join(backupDir, filename);

		const source = new Database(databaseUrl);
		try {
			await source.backup(destPath);
		} finally {
			source.close();
		}

		pruneOldBackups();

		const stat = statSync(destPath);
		return {
			filename,
			sizeBytes: stat.size,
			createdAt: now.toISOString(),
			encrypted: false
		};
	}
}

/**
 * List all available backups sorted by date (newest first).
 * Includes both encrypted (.db.enc) and unencrypted (.db) backups.
 */
export function listBackups(): BackupMetadata[] {
	ensureBackupDir();

	const files = readdirSync(backupDir)
		.filter((f) => f.startsWith('gyre-backup-') && (f.endsWith('.db') || f.endsWith('.db.enc')))
		.map((filename) => {
			const filePath = join(backupDir, filename);
			const stat = statSync(filePath);
			const encrypted = filename.endsWith('.db.enc');

			// Extract timestamp from filename for accuracy
			let createdAt = '';
			try {
				const tsPart = filename
					.replace('gyre-backup-', '')
					.replace(encrypted ? '.db.enc' : '.db', '');
				// Convert 2026-02-17T11-15-56-353Z back to 2026-02-17T11:15:56.353Z
				const parts = tsPart.split('T');
				if (parts.length === 2) {
					const datePart = parts[0];
					const timePart = parts[1].replace(/-/g, (c, offset) => (offset < 8 ? ':' : '.'));
					const date = new Date(`${datePart}T${timePart}`);
					if (!isNaN(date.getTime())) {
						createdAt = date.toISOString();
					}
				}
			} catch (err) {
				logger.warn(err, '[Backup] Failed to parse backup timestamp from filename', { filename });
				createdAt = stat.birthtime.toISOString();
			}

			if (!createdAt) {
				logger.warn('[Backup] Backup timestamp missing after parse, falling back to birthtime', {
					filename
				});
				createdAt = stat.birthtime.toISOString();
			}

			return {
				filename,
				sizeBytes: stat.size,
				createdAt,
				encrypted
			};
		})
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

	return files;
}

/**
 * Get the full path to a backup file (for downloads or deletion).
 * Returns null if the file doesn't exist or the filename is invalid.
 * Accepts both .db and .db.enc extensions.
 */
export function getBackupPath(filename: string): string | null {
	const sanitized = basename(filename);
	if (!BACKUP_FILENAME_RE.test(sanitized)) return null;

	const filePath = join(backupDir, sanitized);
	if (!existsSync(filePath)) return null;

	return filePath;
}

/**
 * Read a backup file as a plain SQLite buffer.
 * If the file is encrypted (.db.enc), it is decrypted before returning.
 * Returns null if the file does not exist or the filename is invalid.
 */
export function getDecryptedBackupBuffer(filename: string): Buffer | null {
	const filePath = getBackupPath(filename);
	if (!filePath) return null;

	const data = readFileSync(filePath);

	if (filename.endsWith('.db.enc')) {
		const key = getBackupEncryptionKey();
		if (!key) {
			throw new BackupError('BACKUP_ENCRYPTION_KEY is not set; cannot decrypt this backup.', 500);
		}
		return decryptBackup(data, key);
	}

	return data;
}

/**
 * Delete a specific backup file.
 */
export function deleteBackup(filename: string): boolean {
	const filePath = getBackupPath(filename);
	if (!filePath) {
		return false;
	}

	unlinkSync(filePath);
	return true;
}

/**
 * Restore the database from a backup buffer.
 * This creates a safety backup of the current DB before restoring.
 *
 * WARNING: This replaces the live database. The application should be
 * restarted after a restore for connections to pick up the new data.
 */
export async function restoreFromBuffer(buffer: Buffer): Promise<BackupMetadata> {
	ensureBackupDir();
	const tempPath = join(backupDir, `_restore-temp-${Date.now()}.db`);

	try {
		// Validate the buffer is a valid SQLite database (exact 16-byte header check)
		const magic = buffer.subarray(0, 16).toString('ascii');
		if (magic !== 'SQLite format 3\0') {
			throw new BackupError('Invalid file: not a valid SQLite database', 400);
		}

		// Validate SQLite page size (bytes 16-17): must be power of 2 between 512 and 65536
		if (buffer.length < 18) {
			throw new BackupError('Invalid file: SQLite header is too short to read page size', 400);
		}
		const pageSize =
			buffer[16] === 0 && buffer[17] === 1
				? 65536 // special encoding for 65536
				: buffer.readUInt16BE(16);
		if (pageSize < 512 || pageSize > 65536 || (pageSize & (pageSize - 1)) !== 0) {
			throw new BackupError('Invalid file: SQLite page size is not a valid power of 2', 400);
		}

		// Create a safety backup before restoring — abort if this fails
		let safetyBackup: BackupMetadata;
		try {
			safetyBackup = await createBackup();
			logger.info(`[Backup] Safety backup created: ${safetyBackup.filename}`);
		} catch {
			throw new BackupError(
				'Failed to create safety backup before restore. Aborting to protect current data.',
				500
			);
		}

		// Write the uploaded DB to a temp file and validate it
		writeFileSync(tempPath, buffer);

		// Open and validate the uploaded DB has the expected schema
		const testDb = new Database(tempPath, { readonly: true });
		try {
			// Check for essential tables
			const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
				name: string;
			}[];
			const tableNames = tables.map((t) => t.name);

			const requiredTables = [
				'users',
				'sessions',
				'verifications',
				'app_settings',
				'clusters',
				'cluster_contexts',
				'audit_logs',
				'rbac_policies',
				'rbac_bindings',
				'auth_providers'
			];
			const missing = requiredTables.filter((t) => !tableNames.includes(t));
			if (missing.length > 0) {
				throw new BackupError(
					`Invalid backup: missing required tables: ${missing.join(', ')}`,
					400
				);
			}

			if (!tableNames.includes('accounts')) {
				throw new BackupError(
					'Invalid backup: missing required auth account data table: accounts',
					400
				);
			}

			// Check users table has expected columns
			const userCols = testDb.prepare('PRAGMA table_info(users)').all() as { name: string }[];
			const userColNames = userCols.map((c) => c.name);
			const requiredUserCols = ['id', 'username', 'role'];
			const missingCols = requiredUserCols.filter((c) => !userColNames.includes(c));
			if (missingCols.length > 0) {
				throw new BackupError(
					`Invalid backup: users table missing columns: ${missingCols.join(', ')}`,
					400
				);
			}
		} finally {
			testDb.close();
		}

		// Checkpoint current WAL and close connection
		const currentDb = new Database(databaseUrl);
		try {
			currentDb.pragma('wal_checkpoint(TRUNCATE)');
		} catch (e) {
			logger.warn(e, '[Backup] Failed to checkpoint current DB before restore:');
		} finally {
			currentDb.close();
		}

		// Explicitly remove stale -wal and -shm files to prevent corruption of the new DB
		for (const suffix of ['-wal', '-shm']) {
			const artifactPath = databaseUrl + suffix;
			try {
				if (existsSync(artifactPath)) {
					unlinkSync(artifactPath);
				}
			} catch (e) {
				logger.error(e, `[Backup] Failed to remove stale artifact ${artifactPath}:`);
			}
		}

		// Replace the database file, closing the cached connection first so
		// subsequent operations open a fresh handle to the new database.
		closeDb();
		copyFileSync(tempPath, databaseUrl);

		// Verify the restored database passes integrity check
		const verifyDb = new Database(databaseUrl, { readonly: true });
		try {
			const result = verifyDb.prepare('PRAGMA integrity_check').get() as {
				integrity_check: string;
			};
			if (result.integrity_check !== 'ok') {
				throw new BackupError(
					`Restored database failed integrity check: ${result.integrity_check}. ` +
						`The pre-restore database was preserved as safety backup "${safetyBackup.filename}" in the backup directory. ` +
						`Restore that file to recover the previous database.`,
					500
				);
			}
		} finally {
			verifyDb.close();
		}

		const stat = statSync(databaseUrl);
		return {
			filename: 'restored-database',
			sizeBytes: stat.size,
			createdAt: new Date().toISOString(),
			encrypted: false
		};
	} finally {
		// Clean up temp file
		if (existsSync(tempPath)) {
			unlinkSync(tempPath);
		}
	}
}

/**
 * Remove old backups beyond the retention limit.
 * Also cleans up orphaned .tmp files left by interrupted encrypted backup writes.
 */
function pruneOldBackups(): void {
	const backups = listBackups();
	if (backups.length > MAX_LOCAL_BACKUPS) {
		const toDelete = backups.slice(MAX_LOCAL_BACKUPS);
		for (const backup of toDelete) {
			const filePath = join(backupDir, backup.filename);
			try {
				unlinkSync(filePath);
				logger.info(`[Backup] Pruned old backup: ${backup.filename}`);
			} catch {
				logger.warn(`[Backup] Failed to prune: ${backup.filename}`);
			}
		}
	}

	// Clean up stale .tmp files from interrupted encrypted backup writes (older than 1 hour)
	const staleThresholdMs = 60 * 60 * 1000;
	const now = Date.now();
	try {
		const entries = readdirSync(backupDir).filter(
			(f) => f.startsWith('gyre-backup-') && f.endsWith('.tmp')
		);
		for (const entry of entries) {
			const filePath = join(backupDir, entry);
			try {
				const { mtimeMs } = statSync(filePath);
				if (now - mtimeMs > staleThresholdMs) {
					unlinkSync(filePath);
					logger.info(`[Backup] Removed orphaned temp file: ${entry}`);
				}
			} catch {
				// File may have been removed concurrently; ignore
			}
		}
	} catch {
		// readdirSync failure is non-fatal for temp cleanup
	}
}

// — Test-only exports (underscore-prefixed, not part of the public API) —
export { encryptBackup as _encryptBackup, decryptBackup as _decryptBackup };
export { getBackupEncryptionKey as _getBackupEncryptionKey };
