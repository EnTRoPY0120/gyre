import { describe, expect, test } from 'vitest';
import {
	assertKustomizationSourceRef,
	assertReadySourceArtifact,
	cleanDiffObject,
	getDiffCacheControl,
	validateGzipArtifact,
	validateKustomizationArtifactPath
} from '../lib/server/flux/use-cases/resource-diff.js';
import { getDesiredResourceComparison } from '../lib/server/flux/use-cases/resource-diff-helpers.js';
import { parseHistoryQuery } from '../lib/server/flux/use-cases/history.js';
import { parseRollbackRequestBody } from '../lib/server/flux/use-cases/rollback.js';
import {
	parseFluxResourceUpdateBody,
	validateFluxResourceUpdateManifest
} from '../lib/server/flux/use-cases/resource-update.js';
import {
	parseBatchOperationRequestBody,
	validateBatchResource
} from '../lib/server/flux/use-cases/batch-operation.js';
import { getSourceControllerPodName } from '../lib/server/flux/use-cases/source-controller-pod.js';
import { MAX_BATCH_SIZE } from '../lib/server/config/limits.js';

function jsonRequest(body: unknown) {
	return new Request('http://localhost', {
		method: 'POST',
		body: JSON.stringify(body)
	});
}

function invalidJsonRequest() {
	return new Request('http://localhost', {
		method: 'POST',
		body: '{'
	});
}

function expectHttpError(errorPromise: Promise<unknown>, status: number, message: string) {
	return expect(errorPromise).rejects.toMatchObject({
		status,
		body: expect.objectContaining({ message })
	});
}

describe('Flux diff use-case helpers', () => {
	test('selects the source-controller pod and reports malformed pod lists', () => {
		expect(
			getSourceControllerPodName(
				{ items: [{ metadata: { name: 'source-controller-1' } }] },
				'flux-system'
			)
		).toBe('source-controller-1');
		expect(() => getSourceControllerPodName({ items: [] }, 'flux-system')).toThrow(
			'No source-controller pod found in flux-system namespace'
		);
		expect(() => getSourceControllerPodName({ items: [{ metadata: {} }] }, 'flux-system')).toThrow(
			'source-controller pod has no name'
		);
	});

	test('selects the existing cache-control values', () => {
		expect(getDiffCacheControl(false)).toBe('max-age=60, private');
		expect(getDiffCacheControl(true)).toBe('no-store, private');
	});

	test('rejects missing sourceRef with the existing client-safe message', () => {
		expect(() =>
			assertKustomizationSourceRef({
				apiVersion: 'kustomize.toolkit.fluxcd.io/v1',
				kind: 'Kustomization',
				metadata: { name: 'app' },
				spec: {}
			})
		).toThrow(expect.objectContaining({ status: 400 }));
	});

	test('rejects unready and missing source artifacts before artifact download', () => {
		const sourceRef = { kind: 'GitRepository', name: 'app' };
		expect(() =>
			assertReadySourceArtifact(
				{
					apiVersion: 'source.toolkit.fluxcd.io/v1',
					kind: 'GitRepository',
					metadata: { name: 'app' },
					status: { conditions: [{ type: 'Ready', status: 'False', reason: 'Failed' }] }
				},
				sourceRef,
				'flux-system'
			)
		).toThrow(expect.objectContaining({ status: 400 }));

		expect(() =>
			assertReadySourceArtifact(
				{
					apiVersion: 'source.toolkit.fluxcd.io/v1',
					kind: 'GitRepository',
					metadata: { name: 'app' },
					status: { conditions: [{ type: 'Ready', status: 'True' }] }
				},
				sourceRef,
				'flux-system'
			)
		).toThrow(expect.objectContaining({ status: 400 }));
	});

	test('rejects untrusted artifact URLs', () => {
		expect(() =>
			assertReadySourceArtifact(
				{
					apiVersion: 'source.toolkit.fluxcd.io/v1',
					kind: 'GitRepository',
					metadata: { name: 'app' },
					status: {
						conditions: [{ type: 'Ready', status: 'True' }],
						artifact: {
							path: 'artifact.tar.gz',
							revision: 'main@sha1:abc123',
							url: 'http://evil.example.com/artifact.tar.gz'
						}
					}
				},
				{ kind: 'GitRepository', name: 'app' },
				'flux-system'
			)
		).toThrow(expect.objectContaining({ status: 400 }));
	});

	test('validates artifact paths and strips noisy diff fields', () => {
		expect(validateKustomizationArtifactPath('/tmp/gyre-diff-abc', './apps')).toBe(
			'/tmp/gyre-diff-abc/apps'
		);
		expect(() => validateKustomizationArtifactPath('/tmp/gyre-diff-abc', '../apps')).toThrow(
			'Path must be relative'
		);

		expect(
			cleanDiffObject({
				metadata: {
					name: 'app',
					resourceVersion: '123',
					annotations: { 'kubectl.kubernetes.io/last-applied-configuration': '{}' },
					labels: { 'kustomize.toolkit.fluxcd.io/name': 'app' }
				},
				status: { ready: true }
			})
		).toEqual({ metadata: { name: 'app' } });
	});

	test('rejects malformed downloaded artifacts before extraction', () => {
		expect(() => validateGzipArtifact(Buffer.from([0x1f]))).toThrow('Downloaded content too small');
		expect(() => validateGzipArtifact(Buffer.from('not-a-gzip'))).toThrow('not a gzip archive');
		expect(() => validateGzipArtifact(Buffer.from([0x1f, 0x8b]))).not.toThrow();
	});

	test('normalizes desired resource identity and namespace fallbacks', () => {
		expect(
			getDesiredResourceComparison(
				{
					apiVersion: 'apps/v1',
					kind: 'Ingress',
					metadata: { name: 'web' }
				},
				{ namespace: 'default', spec: { targetNamespace: 'edge' } }
			)
		).toEqual({
			kind: 'Ingress',
			name: 'web',
			namespace: 'edge',
			group: 'apps',
			version: 'v1',
			plural: 'ingresses'
		});

		expect(
			getDesiredResourceComparison(
				{ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 'config', namespace: 'app' } },
				{ namespace: 'default', spec: {} }
			)
		).toMatchObject({ namespace: 'app', group: '', version: 'v1', plural: 'configmaps' });
	});

	test('ignores incomplete desired resource documents', () => {
		const params = { namespace: 'default', spec: {} };
		expect(getDesiredResourceComparison({ kind: 'ConfigMap' }, params)).toBeNull();
		expect(
			getDesiredResourceComparison(
				{ apiVersion: 'v1', kind: 'ConfigMap', metadata: { name: 42 } },
				params
			)
		).toBeNull();
	});
});

describe('rollback request parsing', () => {
	test('validates invalid JSON, field types, target length, and missing target', async () => {
		await expectHttpError(
			parseRollbackRequestBody(invalidJsonRequest()),
			400,
			'Invalid JSON payload'
		);
		await expectHttpError(
			parseRollbackRequestBody(jsonRequest({ revision: 123 })),
			400,
			'revision must be a string'
		);
		await expectHttpError(
			parseRollbackRequestBody(jsonRequest({ historyId: 'x'.repeat(501) })),
			400,
			'historyId exceeds maximum length of 500 characters'
		);
		await expectHttpError(
			parseRollbackRequestBody(jsonRequest({ dryRun: false })),
			400,
			'Either revision or historyId is required for rollback'
		);
	});

	test('prefers historyId over revision and preserves dryRun', async () => {
		await expect(
			parseRollbackRequestBody(
				jsonRequest({ revision: 'rev-a', historyId: 'hist-a', dryRun: true })
			)
		).resolves.toEqual({
			revision: 'rev-a',
			historyId: 'hist-a',
			target: 'hist-a',
			dryRun: true
		});
	});
});

describe('history query parsing', () => {
	test('applies defaults, clamping, accepted status values, and invalid since handling', () => {
		expect(parseHistoryQuery(new URLSearchParams())).toEqual({ limit: 100 });
		expect(parseHistoryQuery(new URLSearchParams({ limit: '0' }))).toEqual({ limit: 1 });
		expect(parseHistoryQuery(new URLSearchParams({ limit: '5000' }))).toEqual({ limit: 1000 });
		expect(parseHistoryQuery(new URLSearchParams({ limit: 'abc' }))).toEqual({ limit: 100 });
		expect(parseHistoryQuery(new URLSearchParams({ status: 'success' }))).toEqual({
			limit: 100,
			status: 'success'
		});
		expect(parseHistoryQuery(new URLSearchParams({ status: 'pending' }))).toEqual({
			limit: 100
		});
		expect(parseHistoryQuery(new URLSearchParams({ since: 'not-a-date' }))).toEqual({
			limit: 100
		});

		const parsed = parseHistoryQuery(new URLSearchParams({ since: '2024-01-01T00:00:00Z' }));
		expect(parsed.limit).toBe(100);
		expect(parsed.since?.toISOString()).toBe('2024-01-01T00:00:00.000Z');
	});
});

describe('PUT resource update parsing and validation', () => {
	const validManifest = `apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: app
  namespace: flux-system
spec:
  path: ./apps/app
  sourceRef:
    kind: GitRepository
    name: app
`;

	test('validates JSON body and delegates valid manifests', async () => {
		await expectHttpError(
			parseFluxResourceUpdateBody(invalidJsonRequest()),
			400,
			'Invalid JSON in request body'
		);
		await expectHttpError(
			parseFluxResourceUpdateBody(jsonRequest({ yaml: 123 })),
			400,
			'Missing or invalid yaml field in request body'
		);

		const body = await parseFluxResourceUpdateBody(jsonRequest({ yaml: validManifest }));
		expect(body.yaml).toBe(validManifest);
		expect(
			validateFluxResourceUpdateManifest({
				name: 'app',
				namespace: 'flux-system',
				requestBody: body.yaml,
				resourceType: 'Kustomization'
			})
		).toMatchObject({ kind: 'Kustomization', metadata: { name: 'app' } });
	});

	test('rejects invalid YAML, missing fields, kind/apiVersion/spec/name/namespace mismatch', () => {
		expect(() =>
			validateFluxResourceUpdateManifest({
				name: 'app',
				namespace: 'flux-system',
				requestBody: ':',
				resourceType: 'GitRepository'
			})
		).toThrow(expect.objectContaining({ status: 400 }));

		const cases: Array<[string, number, string]> = [
			['kind: GitRepository', 400, 'missing required fields'],
			[validManifest.replace('Kustomization', 'GitRepository'), 400, 'kind mismatch'],
			[
				validManifest.replace(
					'kustomize.toolkit.fluxcd.io/v1',
					'kustomize.toolkit.fluxcd.io/v1beta2'
				),
				400,
				'apiVersion mismatch'
			],
			[
				`${validManifest}  healthCheckExprs:\n    - inProgress: "not valid @"\n`,
				422,
				'Invalid CEL expression'
			],
			[validManifest.replace('name: app', 'name: other'), 400, 'Resource name mismatch'],
			[
				validManifest.replace('namespace: flux-system', 'namespace: other'),
				400,
				'Namespace mismatch'
			]
		];

		for (const [manifest, status, message] of cases) {
			expect(() =>
				validateFluxResourceUpdateManifest({
					name: 'app',
					namespace: 'flux-system',
					requestBody: manifest,
					resourceType: 'Kustomization'
				})
			).toThrow(
				expect.objectContaining({
					status,
					body: expect.objectContaining({ message: expect.stringContaining(message) })
				})
			);
		}
	});
});

describe('batch operation parsing and resource validation', () => {
	test('validates invalid body shapes and max batch size', async () => {
		await expectHttpError(
			parseBatchOperationRequestBody(invalidJsonRequest()),
			400,
			'Invalid JSON in request body'
		);
		await expectHttpError(
			parseBatchOperationRequestBody(jsonRequest({ resources: 'nope' })),
			400,
			'Missing or invalid resources array in request body'
		);
		await expectHttpError(
			parseBatchOperationRequestBody(
				jsonRequest({ resources: Array.from({ length: MAX_BATCH_SIZE + 1 }, () => ({})) })
			),
			400,
			`Batch size exceeded: maximum ${MAX_BATCH_SIZE} resources allowed per request`
		);
	});

	test('validates individual batch resources', async () => {
		await expect(
			parseBatchOperationRequestBody(
				jsonRequest({
					resources: [{ type: 'kustomizations', namespace: 'flux-system', name: 'app' }]
				})
			)
		).resolves.toEqual([{ type: 'kustomizations', namespace: 'flux-system', name: 'app' }]);

		expect(
			validateBatchResource({ type: 'kustomizations', namespace: 'flux-system', name: 'app' })
		).toEqual({ type: 'kustomizations', namespace: 'flux-system', name: 'app' });
		expect(() => validateBatchResource({ type: 'kustomizations' })).toThrow(
			'Invalid resource: missing required fields (type, namespace, name)'
		);
	});
});
