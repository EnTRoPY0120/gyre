import { afterAll, describe, expect, test, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

const {
	searchParamsToFilters,
	filtersToSearchParams,
	filterResources,
	parseLabels,
	defaultFilterState
} = await import('../lib/utils/filtering.js');

// ---------------------------------------------------------------------------
// searchParamsToFilters
// ---------------------------------------------------------------------------

describe('searchParamsToFilters', () => {
	test('unknown status value falls back to all', () => {
		const params = new URLSearchParams({ status: 'invalid-status' });
		const result = searchParamsToFilters(params);
		expect(result.status).toBe('all');
	});

	test('mixed-case status values are accepted after normalization', () => {
		const params = new URLSearchParams({ status: 'HEALTHY' });
		expect(searchParamsToFilters(params).status).toBe('healthy');
		const params2 = new URLSearchParams({ status: 'Progressing' });
		expect(searchParamsToFilters(params2).status).toBe('progressing');
	});

	test('valid status values are preserved', () => {
		for (const status of ['healthy', 'progressing', 'failed', 'suspended', 'unknown']) {
			const params = new URLSearchParams({ status });
			const result = searchParamsToFilters(params);
			expect(result.status).toBe(status);
		}
	});

	test('missing status defaults to all', () => {
		const params = new URLSearchParams();
		const result = searchParamsToFilters(params);
		expect(result.status).toBe('all');
	});

	test('q param longer than 500 chars is truncated', () => {
		const params = new URLSearchParams({ q: 'a'.repeat(600) });
		const result = searchParamsToFilters(params);
		expect(result.search).toHaveLength(500);
	});

	test('ns param longer than 500 chars is truncated', () => {
		const params = new URLSearchParams({ ns: 'b'.repeat(600) });
		const result = searchParamsToFilters(params);
		expect(result.namespace).toHaveLength(500);
	});

	test('labels param longer than 500 chars is truncated', () => {
		const params = new URLSearchParams({ labels: 'c'.repeat(600) });
		const result = searchParamsToFilters(params);
		expect(result.labels).toHaveLength(500);
	});

	test('regex=1 enables regex mode', () => {
		const params = new URLSearchParams({ regex: '1' });
		const result = searchParamsToFilters(params);
		expect(result.useRegex).toBe(true);
	});

	test('missing regex param restores default regex mode', () => {
		const result = searchParamsToFilters(new URLSearchParams());
		expect(result.useRegex).toBe(defaultFilterState.useRegex);
	});
});

afterAll(() => {
	vi.restoreAllMocks();
	vi.resetModules();
});

// ---------------------------------------------------------------------------
// filtersToSearchParams
// ---------------------------------------------------------------------------

describe('filtersToSearchParams', () => {
	test('regex mode is persisted as regex=1', () => {
		const params = filtersToSearchParams({ ...defaultFilterState, useRegex: true });
		expect(params.get('regex')).toBe('1');
	});

	test('default regex mode is omitted from params', () => {
		const params = filtersToSearchParams(defaultFilterState);
		expect(params.has('regex')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// parseLabels
// ---------------------------------------------------------------------------

describe('parseLabels', () => {
	test('parses valid key=value pairs', () => {
		const result = parseLabels('app=nginx,env=prod');
		expect(result).toEqual({ app: 'nginx', env: 'prod' });
	});

	test('skips entry where key exceeds 63 chars', () => {
		const longKey = 'k'.repeat(64);
		const result = parseLabels(`${longKey}=value,app=nginx`);
		expect(result).not.toHaveProperty(longKey);
		expect(result.app).toBe('nginx');
	});

	test('skips entry where value exceeds 63 chars', () => {
		const longValue = 'v'.repeat(64);
		const result = parseLabels(`app=${longValue},env=prod`);
		expect(result).not.toHaveProperty('app');
		expect(result.env).toBe('prod');
	});

	test('keeps entries exactly at 63 chars limit', () => {
		const key = 'k'.repeat(63);
		const value = 'v'.repeat(63);
		const result = parseLabels(`${key}=${value}`);
		expect(result[key]).toBe(value);
	});
});

describe('query and dropdown filters', () => {
	const resources = ['default', 'other'].map((namespace) => ({
		apiVersion: 'v1',
		kind: 'Kustomization',
		metadata: { name: 'nginx', namespace },
		status: { conditions: [{ type: 'Ready', status: 'True' }] }
	}));

	test('ready alias matches healthy resources and combines with both dropdowns', () => {
		expect(
			filterResources(resources, {
				...defaultFilterState,
				search: 'status:ready namespace:default',
				namespace: 'default',
				status: 'healthy'
			})
		).toEqual([resources[0]]);
		expect(
			filterResources(resources, {
				...defaultFilterState,
				search: 'ns:default',
				namespace: 'other'
			})
		).toEqual([]);
		expect(
			filterResources(resources, {
				...defaultFilterState,
				search: 'status:ready',
				status: 'failed'
			})
		).toEqual([]);
	});

	test('invalid tags and valid zero-match text both return arrays', () => {
		expect(filterResources(resources, { ...defaultFilterState, search: 'status:banana' })).toEqual(
			[]
		);
		expect(
			filterResources(resources, { ...defaultFilterState, search: '^missing$', useRegex: true })
		).toEqual([]);
	});

	test('URL round-trip preserves colon text, regex and independent dropdowns', () => {
		const filters = {
			...defaultFilterState,
			search: '^app|https://host ns:default status:ready',
			namespace: 'other',
			useRegex: true
		};
		expect(searchParamsToFilters(filtersToSearchParams(filters))).toEqual(filters);
		expect(filtersToSearchParams({ ...filters, search: 'a'.repeat(600) }).get('q')).toHaveLength(
			500
		);
	});
});
