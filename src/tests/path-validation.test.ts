import { describe, test, expect } from 'bun:test';
import { validateDatabaseUrl, validateBackupDir } from '../lib/server/db/path-validation';

describe('validateDatabaseUrl', () => {
	describe('rejects path traversal sequences', () => {
		test('rejects raw ".." in DATABASE_URL', () => {
			expect(() => validateDatabaseUrl('/data/../etc/passwd')).toThrow(
				'contains path traversal sequences'
			);
		});

		test('rejects ".." at the start of the path', () => {
			expect(() => validateDatabaseUrl('../etc/shadow')).toThrow(
				'contains path traversal sequences'
			);
		});

		test('rejects multiple ".." segments', () => {
			expect(() => validateDatabaseUrl('/data/../../etc/passwd')).toThrow(
				'contains path traversal sequences'
			);
		});

		test('rejects paths that resolve outside allowed roots', () => {
			// No ".." in raw string but resolves outside /data or ./data
			expect(() => validateDatabaseUrl('/tmp/gyre.db')).toThrow('resolves to a disallowed path');
		});

		test('rejects /etc/passwd', () => {
			expect(() => validateDatabaseUrl('/etc/passwd')).toThrow('resolves to a disallowed path');
		});
	});

	describe('accepts valid paths', () => {
		test('accepts /data/gyre.db (production default)', () => {
			// Path may not exist on dev machine — just check it does not throw a traversal error
			expect(() => validateDatabaseUrl('/data/gyre.db')).not.toThrow(
				'contains path traversal sequences'
			);
		});

		test('accepts ./data/gyre.db (development default)', () => {
			// Resolves to <cwd>/data/gyre.db which is under ./data — valid
			expect(() => validateDatabaseUrl('./data/gyre.db')).not.toThrow();
		});

		test('accepts nested path under ./data', () => {
			expect(() => validateDatabaseUrl('./data/subdir/gyre.db')).not.toThrow();
		});
	});
});

describe('validateBackupDir', () => {
	describe('rejects path traversal sequences', () => {
		test('rejects raw ".." in BACKUP_DIR', () => {
			expect(() => validateBackupDir('/data/../../../tmp')).toThrow(
				'contains path traversal sequences'
			);
		});

		test('rejects ".." targeting outside backup root', () => {
			expect(() => validateBackupDir('/data/backups/../../etc')).toThrow(
				'contains path traversal sequences'
			);
		});

		test('rejects paths that resolve outside allowed backup roots', () => {
			expect(() => validateBackupDir('/tmp/backups')).toThrow('resolves to a disallowed path');
		});
	});

	describe('accepts valid paths', () => {
		test('accepts /data/backups (production default)', () => {
			expect(() => validateBackupDir('/data/backups')).not.toThrow(
				'contains path traversal sequences'
			);
		});

		test('accepts ./data/backups (development default)', () => {
			expect(() => validateBackupDir('./data/backups')).not.toThrow();
		});

		test('accepts nested path under ./data/backups', () => {
			expect(() => validateBackupDir('./data/backups/archive')).not.toThrow();
		});
	});
});
