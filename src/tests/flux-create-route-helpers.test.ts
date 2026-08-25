import { describe, expect, test } from 'vitest';
import {
	validateCreateFluxResourceRequest,
	type CreateFluxResourceBody
} from '../routes/api/v1/flux/[resourceType]/create-route-helpers.js';

function gitRepositoryBody(
	overrides: Partial<CreateFluxResourceBody> = {}
): CreateFluxResourceBody {
	return {
		apiVersion: 'source.toolkit.fluxcd.io/v1',
		kind: 'GitRepository',
		metadata: { name: 'demo' },
		spec: { interval: '1m' },
		...overrides
	};
}

function captureError(callback: () => unknown): unknown {
	try {
		callback();
		return undefined;
	} catch (error) {
		return error;
	}
}

describe('validateCreateFluxResourceRequest', () => {
	test('resolves the plural route and supplies the default namespace', () => {
		expect(validateCreateFluxResourceRequest(gitRepositoryBody(), 'gitrepositories')).toMatchObject(
			{
				namespace: 'default',
				resolvedType: 'GitRepository',
				body: { metadata: { namespace: 'default' } }
			}
		);
	});

	test('rejects an unknown resource type before permission checks can run', () => {
		const thrown = captureError(() =>
			validateCreateFluxResourceRequest(gitRepositoryBody(), 'unknownresources')
		);

		expect(thrown).toMatchObject({
			status: 400,
			body: { message: expect.stringContaining('Invalid resource type: unknownresources') }
		});
	});

	test('rejects kind and apiVersion mismatches against the endpoint resource', () => {
		const kindError = captureError(() =>
			validateCreateFluxResourceRequest(
				gitRepositoryBody({ kind: 'Kustomization' }),
				'gitrepositories'
			)
		);
		const versionError = captureError(() =>
			validateCreateFluxResourceRequest(
				gitRepositoryBody({ apiVersion: 'kustomize.toolkit.fluxcd.io/v1' }),
				'gitrepositories'
			)
		);

		expect(kindError).toMatchObject({
			status: 400,
			body: { message: expect.stringContaining('kind mismatch') }
		});
		expect(versionError).toMatchObject({
			status: 400,
			body: { message: expect.stringContaining('apiVersion mismatch') }
		});
	});

	test('rejects unsafe Kustomization expressions with the validation status', () => {
		const thrown = captureError(() =>
			validateCreateFluxResourceRequest(
				{
					apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
					kind: 'Kustomization',
					metadata: { name: 'demo', namespace: 'team-a' },
					spec: { healthCheckExprs: [{ current: '$(whoami)' }] }
				},
				'kustomizations'
			)
		);

		expect(thrown).toMatchObject({
			status: 422,
			body: { message: 'Invalid CEL expression in healthCheckExprs.current' }
		});
	});
});
