/**
 * Database Backup Service
 * Handles creating, listing, and restoring SQLite database backups.
 */

import {
	existsSync,
	mkdirSync,
	readdirSync,
	statSync,
	unlinkSync,
	copyFileSync,
	writeFileSync
} from 'node:fs';
import { join, basename } from 'node:path';
import Database from 'better-sqlite3';

const isInCluster = !!process.env.KUBERNETES_SERVICE_HOST;
const databaseUrl = process.env.DATABASE_URL || (isInCluster ? '/data/gyre.db' : './data/gyre.db');
const backupDir = process.env.BACKUP_DIR || (isInCluster ? '/data/backups' : './data/backups');

// Maximum number of local backups to retain
const MAX_LOCAL_BACKUPS = 10;

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
 * Generate a timestamped backup filename.
 */
function generateBackupFilename(): string {
	const now = new Date();
	const ts = now.toISOString().replace(/[:.]/g, '-');
	return `gyre-backup-${ts}.db`;
}

/**
 * Create a database backup using SQLite's online backup API for atomicity.
 * Returns metadata about the created backup.
 */
export async function createBackup(): Promise<BackupMetadata> {
	ensureBackupDir();

	const filename = generateBackupFilename();
	const destPath = join(backupDir, filename);

	const source = new Database(databaseUrl);
	try {
		// Use built-in backup API for atomic and consistent snapshots
		await source.backup(destPath);
	} finally {
		source.close();
	}

	// Prune old backups beyond retention limit
	pruneOldBackups();

	const stat = statSync(destPath);
	return {
		filename,
		sizeBytes: stat.size,
		createdAt: stat.birthtime.toISOString()
	};
}

/**
 * List all available backups sorted by date (newest first).
 */
export function listBackups(): BackupMetadata[] {
	ensureBackupDir();

	const files = readdirSync(backupDir)
		.filter((f) => f.startsWith('gyre-backup-') && f.endsWith('.db'))
		.map((filename) => {
			const filePath = join(backupDir, filename);
			const stat = statSync(filePath);

			// Extract timestamp from filename for accuracy
			let createdAt = '';
			try {
				const tsPart = filename.replace('gyre-backup-', '').replace('.db', '');
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
			} catch {
				// Fallback to birthtime
				createdAt = stat.birthtime.toISOString();
			}

			if (!createdAt) createdAt = stat.birthtime.toISOString();

			return {
				filename,
				sizeBytes: stat.size,
				createdAt
			};
		})
		.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

	return files;
}

/**
 * Get the full path to a backup file (for downloads).
 * Returns null if the file doesn't exist or the filename is invalid.
 */
export function getBackupPath(filename: string): string | null {
	// Sanitize: only allow expected filenames
	const sanitized = basename(filename);
	if (!sanitized.startsWith('gyre-backup-') || !sanitized.endsWith('.db')) {
		return null;
	}

	const filePath = join(backupDir, sanitized);
	if (!existsSync(filePath)) {
		return null;
	}

	return filePath;
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
	// Validate the buffer is a valid SQLite database
	const magic = buffer.subarray(0, 16).toString('ascii');
	if (!magic.startsWith('SQLite format 3')) {
		throw new BackupError('Invalid file: not a valid SQLite database', 400);
	}

	// Create a safety backup before restoring
	const safetyBackup = await createBackup();
	console.log(`[Backup] Safety backup created: ${safetyBackup.filename}`);

	// Write the uploaded DB to a temp file and validate it
	ensureBackupDir();
	const tempPath = join(backupDir, `_restore-temp-${Date.now()}.db`);

	try {
		// Write buffer to temp file
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
				'app_settings',
				'clusters',
				'cluster_contexts',
				'audit_logs',
				'rbac_policies',
				'rbac_bindings',
				'auth_providers',
				'user_providers'
			];
			const missing = requiredTables.filter((t) => !tableNames.includes(t));
			if (missing.length > 0) {
				throw new BackupError(
					`Invalid backup: missing required tables: ${missing.join(', ')}`,
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
			console.warn('[Backup] Failed to checkpoint current DB before restore:', e);
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
				console.error(`[Backup] Failed to remove stale artifact ${artifactPath}:`, e);
			}
		}

		// Replace the database file
		copyFileSync(tempPath, databaseUrl);

		const stat = statSync(databaseUrl);
		return {
			filename: 'restored-database',
			sizeBytes: stat.size,
			createdAt: new Date().toISOString()
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
 */
function pruneOldBackups(): void {
	const backups = listBackups();
	if (backups.length <= MAX_LOCAL_BACKUPS) return;

	const toDelete = backups.slice(MAX_LOCAL_BACKUPS);
	for (const backup of toDelete) {
		const filePath = join(backupDir, backup.filename);
		try {
			unlinkSync(filePath);
			console.log(`[Backup] Pruned old backup: ${backup.filename}`);
		} catch {
			console.warn(`[Backup] Failed to prune: ${backup.filename}`);
		}
	}
}
