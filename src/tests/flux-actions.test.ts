import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test';

spyOn(console, 'log').mockImplementation(() => {});

// Capture API calls
let capturedPatchArgs: unknown[] = [];
let capturedDeleteArgs: unknown[] = [];
let apiShouldThrow = false;

const mockApi = {
	patchNamespacedCustomObject: async (...args: unknown[]) => {
		capturedPatchArgs = args;
		if (apiShouldThrow) throw new Error('K8s API error');
		return {};
	},
	deleteNamespacedCustomObject: async (...args: unknown[]) => {
		capturedDeleteArgs = args;
		if (apiShouldThrow) throw new Error('K8s API error');
		return {};
	}
};

mock.module('../lib/server/kubernetes/client.js', () => ({
	getCustomObjectsApi: async () => mockApi,
	handleK8sError: (error: unknown, context: string) => {
		return new Error(`K8s error in ${context}: ${error instanceof Error ? error.message : 'Unknown'}`);
	}
}));

import { toggleSuspendResource, reconcileResource, deleteResource } from '../lib/server/kubernetes/flux/actions.js';

describe('toggleSuspendResource', () => {
	beforeEach(() => {
		capturedPatchArgs = [];
		capturedDeleteArgs = [];
		apiShouldThrow = false;
	});

	test('patch body uses add op at /spec/suspend with value: true', async () => {
		await toggleSuspendResource('Kustomization', 'flux-system', 'my-app', true);
		const [params] = capturedPatchArgs as [{ body: unknown[] }, unknown];
		expect(params.body).toEqual([{ op: 'add', path: '/spec/suspend', value: true }]);
	});

	test('patch body uses add op at /spec/suspend with value: false (resume)', async () => {
		await toggleSuspendResource('Kustomization', 'flux-system', 'my-app', false);
		const [params] = capturedPatchArgs as [{ body: unknown[] }, unknown];
		expect(params.body).toEqual([{ op: 'add', path: '/spec/suspend', value: false }]);
	});

	test('plural resource name resolved (kustomizations → Kustomization)', async () => {
		await toggleSuspendResource('kustomizations', 'flux-system', 'my-app', true);
		const [params] = capturedPatchArgs as [{ plural: string }, unknown];
		expect(params.plural).toBe('kustomizations');
	});

	test('correct group/version/plural used for Kustomization', async () => {
		await toggleSuspendResource('Kustomization', 'flux-system', 'my-app', true);
		const [params] = capturedPatchArgs as [{ group: string; version: string; plural: string }, unknown];
		expect(params.group).toBe('kustomize.toolkit.fluxcd.io');
		expect(params.version).toBe('v1');
		expect(params.plural).toBe('kustomizations');
	});

	test('correct group/version/plural used for GitRepository', async () => {
		await toggleSuspendResource('GitRepository', 'flux-system', 'my-repo', true);
		const [params] = capturedPatchArgs as [{ group: string; version: string; plural: string }, unknown];
		expect(params.group).toBe('source.toolkit.fluxcd.io');
		expect(params.version).toBe('v1');
		expect(params.plural).toBe('gitrepositories');
	});

	test('correct group/version/plural used for HelmRelease', async () => {
		await toggleSuspendResource('HelmRelease', 'flux-system', 'my-release', true);
		const [params] = capturedPatchArgs as [{ group: string; version: string; plural: string }, unknown];
		expect(params.group).toBe('helm.toolkit.fluxcd.io');
		expect(params.version).toBe('v2');
		expect(params.plural).toBe('helmreleases');
	});

	test('namespace and name are passed through correctly', async () => {
		await toggleSuspendResource('Kustomization', 'my-namespace', 'target-resource', true);
		const [params] = capturedPatchArgs as [{ namespace: string; name: string }, unknown];
		expect(params.namespace).toBe('my-namespace');
		expect(params.name).toBe('target-resource');
	});

	test('json-patch+json Content-Type header used', async () => {
		await toggleSuspendResource('Kustomization', 'flux-system', 'my-app', true);
		const [, options] = capturedPatchArgs as [unknown, { headers: { 'Content-Type': string } }];
		expect(options.headers['Content-Type']).toBe('application/json-patch+json');
	});

	test('throws for unknown resource type', async () => {
		await expect(toggleSuspendResource('UnknownThing', 'default', 'foo', true)).rejects.toThrow(
			'Unknown resource type: UnknownThing'
		);
	});

	test('K8s API error is transformed by handleK8sError', async () => {
		apiShouldThrow = true;
		await expect(
			toggleSuspendResource('Kustomization', 'flux-system', 'my-app', true)
		).rejects.toThrow('K8s error in suspend/resume my-app');
	});
});

describe('reconcileResource', () => {
	beforeEach(() => {
		capturedPatchArgs = [];
		capturedDeleteArgs = [];
		apiShouldThrow = false;
	});

	test('adds reconcile.fluxcd.io/requestedAt annotation with ISO 8601 timestamp', async () => {
		const before = new Date().toISOString();
		await reconcileResource('Kustomization', 'flux-system', 'my-app');
		const after = new Date().toISOString();
		const [params] = capturedPatchArgs as [
			{ body: { metadata: { annotations: Record<string, string> } } },
			unknown
		];
		const timestamp = params.body.metadata.annotations['reconcile.fluxcd.io/requestedAt'];
		expect(timestamp).toBeTruthy();
		expect(timestamp >= before).toBe(true);
		expect(timestamp <= after).toBe(true);
	});

	test('timestamp is valid ISO 8601 format', async () => {
		await reconcileResource('Kustomization', 'flux-system', 'my-app');
		const [params] = capturedPatchArgs as [
			{ body: { metadata: { annotations: Record<string, string> } } },
			unknown
		];
		const timestamp = params.body.metadata.annotations['reconcile.fluxcd.io/requestedAt'];
		expect(() => new Date(timestamp)).not.toThrow();
		expect(new Date(timestamp).toISOString()).toBe(timestamp);
	});

	test('merge-patch Content-Type header used', async () => {
		await reconcileResource('Kustomization', 'flux-system', 'my-app');
		const [, options] = capturedPatchArgs as [unknown, { headers: { 'Content-Type': string } }];
		expect(options.headers['Content-Type']).toBe('application/merge-patch+json');
	});

	test('correct group/version/plural used for Kustomization', async () => {
		await reconcileResource('Kustomization', 'flux-system', 'my-app');
		const [params] = capturedPatchArgs as [{ group: string; version: string; plural: string }, unknown];
		expect(params.group).toBe('kustomize.toolkit.fluxcd.io');
		expect(params.version).toBe('v1');
		expect(params.plural).toBe('kustomizations');
	});

	test('plural resource name resolved for reconcile', async () => {
		await reconcileResource('kustomizations', 'flux-system', 'my-app');
		const [params] = capturedPatchArgs as [{ plural: string }, unknown];
		expect(params.plural).toBe('kustomizations');
	});

	test('throws for unknown resource type', async () => {
		await expect(reconcileResource('UnknownThing', 'default', 'foo')).rejects.toThrow(
			'Unknown resource type: UnknownThing'
		);
	});

	test('K8s API error is transformed by handleK8sError', async () => {
		apiShouldThrow = true;
		await expect(reconcileResource('Kustomization', 'flux-system', 'my-app')).rejects.toThrow(
			'K8s error in reconcile my-app'
		);
	});
});

describe('deleteResource', () => {
	beforeEach(() => {
		capturedPatchArgs = [];
		capturedDeleteArgs = [];
		apiShouldThrow = false;
	});

	test('calls deleteNamespacedCustomObject with correct group/version/plural/namespace/name', async () => {
		await deleteResource('GitRepository', 'flux-system', 'my-repo');
		const [params] = capturedDeleteArgs as [
			{ group: string; version: string; plural: string; namespace: string; name: string }
		];
		expect(params.group).toBe('source.toolkit.fluxcd.io');
		expect(params.version).toBe('v1');
		expect(params.plural).toBe('gitrepositories');
		expect(params.namespace).toBe('flux-system');
		expect(params.name).toBe('my-repo');
	});

	test('correct group/version/plural used for HelmRelease', async () => {
		await deleteResource('HelmRelease', 'production', 'my-release');
		const [params] = capturedDeleteArgs as [{ group: string; version: string; plural: string }];
		expect(params.group).toBe('helm.toolkit.fluxcd.io');
		expect(params.version).toBe('v2');
		expect(params.plural).toBe('helmreleases');
	});

	test('plural resource name resolved for delete', async () => {
		await deleteResource('gitrepositories', 'flux-system', 'my-repo');
		const [params] = capturedDeleteArgs as [{ plural: string }];
		expect(params.plural).toBe('gitrepositories');
	});

	test('throws for unknown resource type', async () => {
		await expect(deleteResource('UnknownThing', 'default', 'foo')).rejects.toThrow(
			'Unknown resource type: UnknownThing'
		);
	});

	test('K8s API error is transformed by handleK8sError', async () => {
		apiShouldThrow = true;
		await expect(deleteResource('GitRepository', 'flux-system', 'my-repo')).rejects.toThrow(
			'K8s error in delete my-repo'
		);
	});
});
