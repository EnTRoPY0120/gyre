import { describe, expect, test } from 'bun:test';
import type { FluxResource } from '../lib/types/flux.js';
import {
	buildRetryPayload,
	partitionBatchOperationResult,
	type BatchOperationResponse
} from '../lib/components/flux/bulk-actions.js';

function createResource(name: string, namespace: string): FluxResource {
	return {
		kind: 'Kustomization',
		metadata: {
			name,
			namespace,
			uid: `${namespace}-${name}`
		}
	} as FluxResource;
}

describe('partitionBatchOperationResult', () => {
	test('all-success clears selection', () => {
		const selectedResources = [createResource('app-a', 'flux-system')];
		const response: BatchOperationResponse = {
			results: [
				{
					resource: { type: 'Kustomization', namespace: 'flux-system', name: 'app-a' },
					success: true,
					message: 'ok'
				}
			],
			summary: { total: 1, successful: 1, failed: 0 }
		};

		const result = partitionBatchOperationResult(selectedResources, response);

		expect(result.allSucceeded).toBe(true);
		expect(result.nextSelectedResources).toEqual([]);
	});

	test('partial failure keeps only failed resources selected', () => {
		const selectedResources = [
			createResource('app-a', 'flux-system'),
			createResource('app-b', 'default')
		];
		const response: BatchOperationResponse = {
			results: [
				{
					resource: { type: 'Kustomization', namespace: 'flux-system', name: 'app-a' },
					success: true,
					message: 'ok'
				},
				{
					resource: { type: 'Kustomization', namespace: 'default', name: 'app-b' },
					success: false,
					message: 'permission denied'
				}
			],
			summary: { total: 2, successful: 1, failed: 1 }
		};

		const result = partitionBatchOperationResult(selectedResources, response);

		expect(result.allSucceeded).toBe(false);
		expect(result.allFailed).toBe(false);
		expect(result.nextSelectedResources.map((resource) => resource.metadata.name)).toEqual([
			'app-b'
		]);
		expect(result.failedResources[0]?.message).toBe('permission denied');
	});

	test('all-failure keeps the full original selection', () => {
		const selectedResources = [
			createResource('app-a', 'flux-system'),
			createResource('app-b', 'default')
		];
		const response: BatchOperationResponse = {
			results: [
				{
					resource: { type: 'Kustomization', namespace: 'flux-system', name: 'app-a' },
					success: false,
					message: 'timeout'
				},
				{
					resource: { type: 'Kustomization', namespace: 'default', name: 'app-b' },
					success: false,
					message: 'permission denied'
				}
			],
			summary: { total: 2, successful: 0, failed: 2 }
		};

		const result = partitionBatchOperationResult(selectedResources, response);

		expect(result.allFailed).toBe(true);
		expect(result.nextSelectedResources.map((resource) => resource.metadata.name)).toEqual([
			'app-a',
			'app-b'
		]);
	});

	test('retry payload includes only failed resources', () => {
		const selectedResources = [
			createResource('app-a', 'flux-system'),
			createResource('app-b', 'default')
		];
		const response: BatchOperationResponse = {
			results: [
				{
					resource: { type: 'Kustomization', namespace: 'flux-system', name: 'app-a' },
					success: true,
					message: 'ok'
				},
				{
					resource: { type: 'Kustomization', namespace: 'default', name: 'app-b' },
					success: false,
					message: 'still failing'
				}
			],
			summary: { total: 2, successful: 1, failed: 1 }
		};

		const result = partitionBatchOperationResult(selectedResources, response);

		expect(buildRetryPayload(result.failedResources)).toEqual([
			{ type: 'Kustomization', namespace: 'default', name: 'app-b' }
		]);
	});
});
