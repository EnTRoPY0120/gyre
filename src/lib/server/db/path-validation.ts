import { resolve, dirname, basename, join, relative, normalize } from 'node:path';
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
			return join(realDir, basename(resolved));
		} catch {
			return normalize(resolve(p));
		}
	}
}

/**
 * Validates that a database URL resolves to an allowed root directory.
 * Canonicalizes both the target path and each allowed root via realpathSync
 * so symlinks are followed before comparison.
 * Uses path.relative for platform-aware containment checking.
 *
 * Allowed roots: /data (production PV mount) or ./data (local development).
 *
 * @throws if the path resolves outside the allowed roots.
 * @returns the canonicalized path for informational use.
 */
export function validateDatabaseUrl(databaseUrl: string): string {
	const realPath = canonicalize(databaseUrl);

	const allowedRoots = ['/data', resolve('./data')].map(canonicalize);

	// path.relative is platform-aware: if realPath is outside root, the result starts with '..'
	const isAllowed = allowedRoots.some((root) => {
		const rel = relative(normalize(root), normalize(realPath));
		return !rel.startsWith('..');
	});

	if (!isAllowed) {
		throw new Error(
			`DATABASE_URL resolves to a disallowed path: ${realPath}. Must be under /data or ./data`
		);
	}

	return realPath;
}
