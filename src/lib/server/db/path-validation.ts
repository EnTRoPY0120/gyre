import { resolve, dirname, basename, join, relative, normalize, isAbsolute } from 'node:path';
import { realpathSync } from 'node:fs';

/**
 * Canonicalizes a path by following all symlinks.
 * Falls back to parent-dir resolution if the path does not exist yet (first run),
 * and further falls back to normalize(path) if the parent also doesn't exist.
 */
function canonicalize(p: string): string {
	try {
		return realpathSync(p);
	} catch {
		try {
			const resolved = resolve(p);
			const realDir = realpathSync(dirname(resolved));
			const candidate = join(realDir, basename(resolved));
			// Attempt to resolve the final component as well; if it now exists
			// (e.g. as a symlink) follow it to its real target.
			try {
				return realpathSync(candidate);
			} catch {
				return candidate;
			}
		} catch {
			return normalize(resolve(p));
		}
	}
}

/**
 * Validates that a path is contained within one of the allowed root directories.
 * Two independent gates:
 *   1. Raw segment check — rejects any path containing '..' before normalization.
 *   2. Canonicalization check — resolves symlinks then verifies containment via path.relative.
 *
 * @throws if the path contains traversal sequences or resolves outside the allowed roots.
 * @returns the canonicalized path.
 */
function validatePathUnderRoots(rawPath: string, allowedRoots: string[], label: string): string {
	// Gate 1: reject raw '..' segments before any normalization
	const segments = rawPath.replace(/\\/g, '/').split('/');
	if (segments.includes('..')) {
		throw new Error(`${label} contains path traversal sequences: ${rawPath}`);
	}

	// Gate 2: canonicalize (follows symlinks), then containment check
	const realPath = canonicalize(rawPath);
	const canonicalRoots = allowedRoots.map(canonicalize);

	// path.relative is platform-aware: result starts with '..' when realPath is outside root.
	// isAbsolute(rel) guards against Windows cross-drive results (e.g. 'D:\file') which would
	// not start with '..' yet are clearly outside the allowed root.
	const isAllowed = canonicalRoots.some((root) => {
		const rel = relative(normalize(root), normalize(realPath));
		return !rel.startsWith('..') && !isAbsolute(rel);
	});

	if (!isAllowed) {
		throw new Error(
			`${label} resolves to a disallowed path: ${realPath}. Must be under ${allowedRoots.join(' or ')}`
		);
	}

	return realPath;
}

/**
 * Validates that a database URL resolves to an allowed root directory.
 * Allowed roots: /data (production PV mount) or ./data (local development).
 *
 * @throws if the path resolves outside the allowed roots.
 * @returns the canonicalized path for informational use.
 */
export function validateDatabaseUrl(databaseUrl: string): string {
	return validatePathUnderRoots(
		databaseUrl,
		['/data', resolve('./data'), ...getRuntimeTestAllowedRoots('GYRE_RUNTIME_DATABASE_ROOT')],
		'DATABASE_URL'
	);
}

/**
 * Validates that a backup directory resolves to an allowed root directory.
 * Allowed roots: /data/backups (production PV mount) or ./data/backups (local development).
 *
 * @throws if the path resolves outside the allowed roots.
 * @returns the canonicalized path for informational use.
 */
export function validateBackupDir(backupDir: string): string {
	return validatePathUnderRoots(
		backupDir,
		[
			'/data/backups',
			resolve('./data/backups'),
			...getRuntimeTestAllowedRoots('GYRE_RUNTIME_BACKUP_ROOT')
		],
		'BACKUP_DIR'
	);
}

function getRuntimeTestAllowedRoots(envName: string): string[] {
	if (process.env.GYRE_RUNTIME_TEST_MODE !== '1') {
		return [];
	}

	const root = process.env[envName];
	return root ? [root] : [];
}
