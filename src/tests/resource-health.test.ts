import { afterAll, describe, expect, mock, test } from 'bun:test';

// Mock SvelteKit virtual modules before importing anything that depends on them
mock.module('$app/environment', () => ({ dev: false }));
mock.module('$env/dynamic/public', () => ({ env: {} }));

import { getResourceHealth } from '../lib/utils/flux.js';
import type { K8sCondition } from '../lib/server/kubernetes/flux/types.js';

// For filtering tests, use dynamic import to ensure mocks are applied first
const {
	filterResources,
	parseLabels,
	getUniqueNamespaces,
	hasActiveFilters,
	filtersToSearchParams,
	searchParamsToFilters,
	defaultFilterState
} = await import('../lib/utils/filtering.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCondition(
	type: string,
	status: 'True' | 'False' | 'Unknown',
	reason?: string
): K8sCondition {
	return { type, status, reason };
}

function makeResource(
	name: string,
	namespace: string,
	opts: {
		labels?: Record<string, string>;
		ready?: 'True' | 'False' | 'Unknown';
		readyReason?: string;
		suspended?: boolean;
	} = {}
) {
	return {
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		kind: 'GitRepository',
		metadata: { name, namespace, labels: opts.labels },
		spec: { suspend: opts.suspended ?? false },
		status: opts.ready
			? { conditions: [makeCondition('Ready', opts.ready, opts.readyReason)] }
			: undefined
	};
}

// ---------------------------------------------------------------------------
// getResourceHealth
// ---------------------------------------------------------------------------

describe('getResourceHealth', () => {
	test('suspended resource returns suspended', () => {
		const conditions = [makeCondition('Ready', 'True')];
		expect(getResourceHealth(conditions, true)).toBe('suspended');
	});

	test('no conditions returns unknown', () => {
		expect(getResourceHealth([])).toBe('unknown');
		expect(getResourceHealth(undefined)).toBe('unknown');
	});

	test('Ready=True returns healthy', () => {
		const conditions = [makeCondition('Ready', 'True')];
		expect(getResourceHealth(conditions)).toBe('healthy');
	});

	test('Ready=False with no special reason returns failed', () => {
		const conditions = [makeCondition('Ready', 'False', 'BuildFailed')];
		expect(getResourceHealth(conditions)).toBe('failed');
	});

	test('Ready=False with Progressing reason returns progressing', () => {
		const conditions = [makeCondition('Ready', 'False', 'Progressing')];
		expect(getResourceHealth(conditions)).toBe('progressing');
	});

	test('Ready=False with ReconciliationInProgress reason returns progressing', () => {
		const conditions = [makeCondition('Ready', 'False', 'ReconciliationInProgress')];
		expect(getResourceHealth(conditions)).toBe('progressing');
	});

	test('Ready=False with DependencyNotReady reason returns progressing', () => {
		const conditions = [makeCondition('Ready', 'False', 'DependencyNotReady')];
		expect(getResourceHealth(conditions)).toBe('progressing');
	});

	test('Ready=Unknown returns progressing', () => {
		const conditions = [makeCondition('Ready', 'Unknown')];
		expect(getResourceHealth(conditions)).toBe('progressing');
	});

	test('Stalled=True takes priority over Ready=True', () => {
		const conditions = [makeCondition('Ready', 'True'), makeCondition('Stalled', 'True')];
		expect(getResourceHealth(conditions)).toBe('failed');
	});

	test('observedGeneration behind generation returns progressing', () => {
		const conditions = [makeCondition('Ready', 'True')];
		expect(getResourceHealth(conditions, false, 1, 3)).toBe('progressing');
	});

	test('observedGeneration equal to generation does not trigger progressing', () => {
		const conditions = [makeCondition('Ready', 'True')];
		expect(getResourceHealth(conditions, false, 3, 3)).toBe('healthy');
	});

	test('Reconciling=True returns progressing when no Ready condition', () => {
		const conditions = [makeCondition('Reconciling', 'True')];
		expect(getResourceHealth(conditions)).toBe('progressing');
	});

	test('no matching conditions returns unknown', () => {
		const conditions = [makeCondition('SomeOtherCondition', 'True')];
		expect(getResourceHealth(conditions)).toBe('unknown');
	});
});

afterAll(() => {
	mock.restore();
});

// ---------------------------------------------------------------------------
// filterResources
// ---------------------------------------------------------------------------

describe('filterResources', () => {
	const resources = [
		makeResource('repo-a', 'flux-system', { ready: 'True', labels: { app: 'foo', env: 'prod' } }),
		makeResource('repo-b', 'flux-system', { ready: 'False', readyReason: 'BuildFailed' }),
		makeResource('repo-c', 'default', { ready: 'True', labels: { app: 'bar' } }),
		makeResource('repo-d', 'kube-system', { suspended: true })
	];

	test('empty filter returns all resources', () => {
		expect(filterResources(resources, defaultFilterState)).toHaveLength(4);
	});

	test('namespace filter excludes non-matching resources', () => {
		const result = filterResources(resources, { ...defaultFilterState, namespace: 'flux-system' });
		expect(result).toHaveLength(2);
		for (const r of result) {
			expect(r.metadata.namespace).toBe('flux-system');
		}
	});

	test('status filter: healthy excludes failed and suspended', () => {
		const result = filterResources(resources, { ...defaultFilterState, status: 'healthy' });
		expect(result.every((r) => r.spec?.suspend !== true)).toBe(true);
		expect(result.every((r) => r.status?.conditions?.[0]?.status === 'True')).toBe(true);
	});

	test('status filter: failed shows only failed resources', () => {
		const result = filterResources(resources, { ...defaultFilterState, status: 'failed' });
		expect(result).toHaveLength(1);
		expect(result[0].metadata.name).toBe('repo-b');
	});

	test('status filter: suspended shows only suspended resources', () => {
		const result = filterResources(resources, { ...defaultFilterState, status: 'suspended' });
		expect(result).toHaveLength(1);
		expect(result[0].metadata.name).toBe('repo-d');
	});

	test('labels filter: app=foo only returns resources with that label', () => {
		const result = filterResources(resources, { ...defaultFilterState, labels: 'app=foo' });
		expect(result).toHaveLength(1);
		expect(result[0].metadata.name).toBe('repo-a');
	});

	test('labels filter: multiple labels narrows results', () => {
		const result = filterResources(resources, {
			...defaultFilterState,
			labels: 'app=foo,env=prod'
		});
		expect(result).toHaveLength(1);
		expect(result[0].metadata.name).toBe('repo-a');
	});

	test('labels filter with no matching resources returns empty', () => {
		const result = filterResources(resources, { ...defaultFilterState, labels: 'app=nonexistent' });
		expect(result).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// parseLabels
// ---------------------------------------------------------------------------

describe('parseLabels', () => {
	test('parses key=value pair', () => {
		expect(parseLabels('app=foo')).toEqual({ app: 'foo' });
	});

	test('parses multiple pairs', () => {
		expect(parseLabels('app=foo,env=prod')).toEqual({ app: 'foo', env: 'prod' });
	});

	test('empty string returns empty object', () => {
		expect(parseLabels('')).toEqual({});
		expect(parseLabels('   ')).toEqual({});
	});

	test('handles spaces around separators', () => {
		const result = parseLabels('app = foo , env = prod');
		expect(result).toEqual({ app: 'foo', env: 'prod' });
	});
});

// ---------------------------------------------------------------------------
// getUniqueNamespaces
// ---------------------------------------------------------------------------

describe('getUniqueNamespaces', () => {
	test('returns sorted deduplicated namespaces', () => {
		const resources = [
			makeResource('a', 'flux-system'),
			makeResource('b', 'default'),
			makeResource('c', 'flux-system'), // duplicate
			makeResource('d', 'kube-system')
		];
		const ns = getUniqueNamespaces(resources);
		expect(ns).toEqual(['default', 'flux-system', 'kube-system']);
	});

	test('returns empty array for resources with no namespace', () => {
		const resources = [{ apiVersion: 'v1', kind: 'Test', metadata: { name: 'x' } }];
		expect(getUniqueNamespaces(resources as never)).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// hasActiveFilters
// ---------------------------------------------------------------------------

describe('hasActiveFilters', () => {
	test('returns false for default filter state', () => {
		expect(hasActiveFilters(defaultFilterState)).toBe(false);
	});

	test('returns true when search is set', () => {
		expect(hasActiveFilters({ ...defaultFilterState, search: 'nginx' })).toBe(true);
	});

	test('returns true when namespace is set', () => {
		expect(hasActiveFilters({ ...defaultFilterState, namespace: 'flux-system' })).toBe(true);
	});

	test('returns true when status is not all', () => {
		expect(hasActiveFilters({ ...defaultFilterState, status: 'healthy' })).toBe(true);
	});

	test('returns true when labels is set', () => {
		expect(hasActiveFilters({ ...defaultFilterState, labels: 'app=foo' })).toBe(true);
	});

	test('returns true when regex mode is enabled', () => {
		expect(hasActiveFilters({ ...defaultFilterState, useRegex: true })).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// filtersToSearchParams / searchParamsToFilters round-trip
// ---------------------------------------------------------------------------

describe('filtersToSearchParams / searchParamsToFilters', () => {
	test('round-trips all filter fields', () => {
		const original = {
			search: 'nginx',
			namespace: 'flux-system',
			status: 'healthy' as const,
			labels: 'app=foo',
			useRegex: true
		};
		const params = filtersToSearchParams(original);
		const restored = searchParamsToFilters(params);
		expect(restored.search).toBe(original.search);
		expect(restored.namespace).toBe(original.namespace);
		expect(restored.status).toBe(original.status);
		expect(restored.labels).toBe(original.labels);
		expect(restored.useRegex).toBe(original.useRegex);
	});

	test('empty default state produces empty params', () => {
		const params = filtersToSearchParams(defaultFilterState);
		expect(params.toString()).toBe('');
	});

	test('empty params produce default filter state', () => {
		const filters = searchParamsToFilters(new URLSearchParams());
		expect(filters.search).toBe('');
		expect(filters.namespace).toBe('');
		expect(filters.status).toBe('all');
		expect(filters.labels).toBe('');
		expect(filters.useRegex).toBe(false);
	});
});
