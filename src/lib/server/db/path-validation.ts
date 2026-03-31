import { resolve, dirname, basename, join } from 'node:path';
import { realpathSync } from 'node:fs';

/**
 * Validates that a database URL resolves to an allowed root directory.
 * Uses realpathSync on the parent directory to follow symlinks, preventing
 * symlink-based path escapes. Falls back to the resolved path if the parent
 * directory does not yet exist (e.g. on first run).
 *
 * Allowed roots: /data (production PV mount) or ./data (local development).
 *
 * @throws if the path resolves outside the allowed roots.
 * @returns the resolved (symlink-followed) path for informational use.
 */
export function validateDatabaseUrl(databaseUrl: string): string {
	const resolved = resolve(databaseUrl);

	// Follow symlinks in the parent directory to prevent symlink-based escapes.
	// The file itself may not exist yet (first run), but the parent must exist
	// if symlinks are present — handle the case where it doesn't.
	let realPath: string;
	try {
		const realDir = realpathSync(dirname(resolved));
		realPath = join(realDir, basename(resolved));
	} catch {
		// Parent directory does not exist yet (first run) — no symlinks possible.
		realPath = resolved;
	}

	const allowedRoots = ['/data', resolve('./data')];
	const isAllowed = allowedRoots.some(
		(root) => realPath === root || realPath.startsWith(root + '/')
	);

	if (!isAllowed) {
		throw new Error(
			`DATABASE_URL resolves to a disallowed path: ${realPath}. Must be under /data or ./data`
		);
	}

	return realPath;
}
