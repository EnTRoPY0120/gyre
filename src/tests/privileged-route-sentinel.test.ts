import { describe, expect, test } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const routeRoot = join(repoRoot, 'src', 'routes');
const apiRouteRoot = join(routeRoot, 'api', 'v1');

async function routeFilesUnder(path: string): Promise<string[]> {
	const entries = await readdir(path, { recursive: true, withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name === '+server.ts')
		.map((entry) => join(entry.parentPath, entry.name))
		.sort();
}

function read(path: string): string {
	return readFileSync(path, 'utf8');
}

function routeId(path: string): string {
	return relative(repoRoot, path);
}

function hasStateChangingHandler(source: string): boolean {
	return /export const (POST|PUT|PATCH|DELETE)\s*:/.test(source);
}

describe('privileged route enforcement sentinel', () => {
	test('legacy Flux [type] action route tree does not exist', () => {
		expect(existsSync(join(apiRouteRoot, 'flux', '[type]'))).toBe(false);
	});

	test('Flux action and log docs use canonical resourceType route params', () => {
		const docs = read(join(repoRoot, 'documentation', 'docs', 'api', 'README.md'));
		expect(docs).not.toMatch(
			/\/api\/v1\/flux\/\{type\}\/\{namespace\}\/\{name\}\/(?:reconcile|suspend|resume|logs)/
		);
		expect(docs).toContain('/api/v1/flux/{resourceType}/{namespace}/{name}/reconcile');
		expect(docs).toContain('/api/v1/flux/{resourceType}/{namespace}/{name}/suspend');
		expect(docs).toContain('/api/v1/flux/{resourceType}/{namespace}/{name}/resume');
		expect(docs).toContain('/api/v1/flux/{resourceType}/{namespace}/{name}/logs');
	});

	test('privileged state-changing routes delegate enforcement to centralized helpers', async () => {
		const roots = ['admin', 'flux', 'user'].map((segment) => join(apiRouteRoot, segment));
		const files = (await Promise.all(roots.map(routeFilesUnder))).flat();
		const missingCentralEnforcement = files
			.filter((file) => hasStateChangingHandler(read(file)))
			.filter((file) => {
				const source = read(file);
				return !(
					source.includes('$lib/server/http/guards') ||
					source.includes('$lib/server/flux/use-cases/')
				);
			})
			.map(routeId);

		expect(missingCentralEnforcement).toEqual([]);
	});

	test('API routes do not import raw privileged enforcement primitives', async () => {
		const files = await routeFilesUnder(apiRouteRoot);
		const allowedRawImports = [
			'src/routes/api/v1/auth/login/+server.ts',
			'src/routes/api/v1/auth/logout/+server.ts',
			'src/routes/api/v1/auth/change-password/+server.ts',
			'src/routes/api/v1/auth/[providerId]/login/+server.ts',
			'src/routes/api/v1/auth/[providerId]/callback/+server.ts'
		];

		const offenders = files
			.filter((file) => !allowedRawImports.includes(routeId(file)))
			.filter((file) =>
				/['"]\$lib\/server\/(?:rbac|rate-limiter|audit)(?:\.js)?['"]/.test(read(file))
			)
			.map(routeId);

		expect(offenders).toEqual([]);
	});

	test('public unauthenticated endpoints are explicitly allowlisted', () => {
		const publicRoutes = read(join(repoRoot, 'src', 'lib', 'isPublicRoute.ts'));
		expect(publicRoutes).toContain("'/api/v1/health'");
		expect(publicRoutes).toContain("'/api/v1/flux/health'");
		expect(publicRoutes).toContain("'/metrics'");
		expect(publicRoutes).toContain('PUBLIC_OAUTH_ROUTE_PATTERN');
	});
});
