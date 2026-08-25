import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
	fetchReferenceResources,
	getReferenceResourcesAfterFetch,
	isAbortError,
	type ReferenceOption
} from '../lib/components/wizards/reference-fetch.js';

const mocks = vi.hoisted(() => ({ fetchWithRetry: vi.fn() }));
vi.mock('$lib/utils/fetch', () => mocks);

function response(items: unknown[], ok = true) {
	return {
		ok,
		status: ok ? 200 : 500,
		statusText: ok ? 'OK' : 'Internal Server Error',
		json: async () => ({ items }),
		text: async () => 'request failed'
	};
}

function option(kind: string, name: string, namespace = 'default'): ReferenceOption {
	return {
		key: `${kind}:${namespace}:${name}`,
		kind,
		name,
		namespace,
		label: `${name} (${namespace})`,
		searchText: `${name} ${namespace} ${kind}`.toLowerCase()
	};
}

describe('reference resource fetching', () => {
	beforeEach(() => mocks.fetchWithRetry.mockReset());

	test('fetches multiple kinds and labels their options with the kind', async () => {
		mocks.fetchWithRetry
			.mockResolvedValueOnce(
				response([{ kind: 'Kustomization', metadata: { name: 'app', namespace: 'team-a' } }])
			)
			.mockResolvedValueOnce(
				response([{ kind: 'HelmRelease', metadata: { name: 'chart', namespace: 'team-a' } }])
			);

		const result = await fetchReferenceResources(
			['Kustomization', 'HelmRelease'],
			[],
			new AbortController().signal
		);

		expect(result.sawFailure).toBe(false);
		expect(result.resources.map((item) => item.label)).toEqual([
			'app (team-a, Kustomization)',
			'chart (team-a, HelmRelease)'
		]);
	});

	test('keeps existing resources for a kind whose refresh fails', async () => {
		mocks.fetchWithRetry
			.mockResolvedValueOnce(response([{ kind: 'Kustomization', metadata: { name: 'fresh' } }]))
			.mockRejectedValueOnce(new Error('temporary failure'));
		const existing = [option('HelmRelease', 'cached')];

		const result = await fetchReferenceResources(
			['Kustomization', 'HelmRelease'],
			existing,
			new AbortController().signal
		);

		expect(result.sawFailure).toBe(true);
		expect(result.resources.map((item) => item.name)).toEqual(['cached', 'fresh']);
	});

	test('identifies aborted errors without treating ordinary errors as aborts', () => {
		const abortError = new Error('aborted');
		Object.defineProperty(abortError, 'name', { value: 'AbortError' });

		expect(isAbortError(abortError)).toBe(true);
		expect(isAbortError(new Error('aborted'))).toBe(false);
	});

	test('keeps the previous list when a failed refresh returns no fresh resources', () => {
		const existing = [option('Kustomization', 'cached')];
		expect(getReferenceResourcesAfterFetch({ resources: [], sawFailure: true }, existing)).toBe(
			existing
		);
		expect(getReferenceResourcesAfterFetch({ resources: [], sawFailure: false }, existing)).toEqual(
			[]
		);
	});
});
