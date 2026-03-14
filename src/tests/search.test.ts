import { describe, test, expect, mock } from 'bun:test';

// Mock SvelteKit virtual modules before importing anything that depends on them
mock.module('$app/environment', () => ({ dev: false }));
mock.module('$env/dynamic/public', () => ({ env: {} }));

const { advancedSearch, parseQuery } = await import('../lib/utils/search.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItems(names: string[], namespace = 'default') {
	return names.map((name) => ({
		metadata: { name, namespace }
	}));
}

// ---------------------------------------------------------------------------
// advancedSearch
// ---------------------------------------------------------------------------

describe('advancedSearch', () => {
	test('empty query returns all items unchanged', () => {
		const items = makeItems(['nginx', 'redis', 'postgres']);
		expect(advancedSearch(items, '')).toBe(items);
	});

	test('fuzzy finds items matching query', () => {
		const items = makeItems(['nginx-deployment', 'redis-cache', 'postgres-db']);
		const result = advancedSearch(items, 'nginx');
		expect(result.length).toBeGreaterThan(0);
		expect(result[0].metadata.name).toBe('nginx-deployment');
	});

	test('fuzzy returns empty array when nothing matches', () => {
		const items = makeItems(['nginx', 'redis', 'postgres']);
		const result = advancedSearch(items, 'zzzznowaythismatches9999');
		expect(result).toHaveLength(0);
	});

	test('regex: true uses regex matching', () => {
		const items = makeItems(['nginx-v1', 'nginx-v2', 'redis-v1']);
		const result = advancedSearch(items, '^nginx', { regex: true });
		expect(result).toHaveLength(2);
		expect(result.every((r) => r.metadata.name.startsWith('nginx'))).toBe(true);
	});

	test('regex: invalid pattern returns empty array', () => {
		const items = makeItems(['nginx', 'redis']);
		const result = advancedSearch(items, '[invalid(regex', { regex: true });
		expect(result).toHaveLength(0);
	});

	test('regex: false with fuzzy: false does literal matching', () => {
		const items = makeItems(['nginx-deployment', 'redis-cache']);
		const result = advancedSearch(items, 'nginx-deployment', { fuzzy: false, regex: false });
		expect(result).toHaveLength(1);
		expect(result[0].metadata.name).toBe('nginx-deployment');
	});

	test('searches across specified keys', () => {
		const items = [
			{ metadata: { name: 'alpha', namespace: 'flux-system' } },
			{ metadata: { name: 'beta', namespace: 'default' } }
		];
		const result = advancedSearch(items, 'flux-system', {
			keys: ['metadata.namespace'],
			fuzzy: false,
			regex: false
		});
		expect(result).toHaveLength(1);
		expect(result[0].metadata.namespace).toBe('flux-system');
	});

	test('caching: same array reference reuses Fuse instance', () => {
		const items = makeItems(['nginx', 'redis']);
		// Calling twice with same reference should not throw or change behavior
		const r1 = advancedSearch(items, 'nginx');
		const r2 = advancedSearch(items, 'nginx');
		expect(r1).toEqual(r2);
	});

	test('caching: new array reference rebuilds Fuse instance', () => {
		const items1 = makeItems(['nginx', 'redis']);
		const items2 = [...items1]; // different reference, same content
		const r1 = advancedSearch(items1, 'nginx');
		const r2 = advancedSearch(items2, 'nginx');
		// Both should return the same logical result
		expect(r1[0].metadata.name).toBe(r2[0].metadata.name);
	});
});

// ---------------------------------------------------------------------------
// parseQuery
// ---------------------------------------------------------------------------

describe('parseQuery', () => {
	test('plain text returns no tags', () => {
		const result = parseQuery('nginx');
		expect(result.query).toBe('nginx');
		expect(result.tags).toEqual({});
	});

	test('extracts single tag from query', () => {
		const result = parseQuery('nginx ns:flux-system');
		expect(result.query).toBe('nginx');
		expect(result.tags).toEqual({ ns: 'flux-system' });
	});

	test('extracts multiple tags', () => {
		const result = parseQuery('text ns:default status:healthy');
		expect(result.tags.ns).toBe('default');
		expect(result.tags.status).toBe('healthy');
		expect(result.query).toBe('text');
	});

	test('query with only tags has empty text', () => {
		const result = parseQuery('ns:flux-system status:failed');
		expect(result.query).toBe('');
		expect(result.tags.ns).toBe('flux-system');
		expect(result.tags.status).toBe('failed');
	});

	test('empty string returns empty query and tags', () => {
		const result = parseQuery('');
		expect(result.query).toBe('');
		expect(result.tags).toEqual({});
	});

	test('tag values are extracted verbatim', () => {
		const result = parseQuery('ns:my-special-namespace');
		expect(result.tags.ns).toBe('my-special-namespace');
	});
});
