import { describe, test, expect } from 'bun:test';
import * as k8s from '@kubernetes/client-node';
import {
	DEFAULT_TIMEOUT_MS,
	OPERATION_TIMEOUTS,
	handleK8sError,
	_createTimeoutMiddleware
} from '../lib/server/kubernetes/client.js';
import {
	KubernetesTimeoutError,
	ClusterUnavailableError,
	ResourceNotFoundError,
	AuthenticationError,
	AuthorizationError,
	KubernetesError
} from '../lib/server/kubernetes/errors.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Timeout constants', () => {
	test('DEFAULT_TIMEOUT_MS is 30 seconds', () => {
		expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
	});

	test('OPERATION_TIMEOUTS.list is 30 seconds', () => {
		expect(OPERATION_TIMEOUTS.list).toBe(30_000);
	});

	test('OPERATION_TIMEOUTS.get is 15 seconds', () => {
		expect(OPERATION_TIMEOUTS.get).toBe(15_000);
	});

	test('OPERATION_TIMEOUTS.logs is 60 seconds', () => {
		expect(OPERATION_TIMEOUTS.logs).toBe(60_000);
	});
});

// ---------------------------------------------------------------------------
// KubernetesTimeoutError
// ---------------------------------------------------------------------------

describe('KubernetesTimeoutError', () => {
	test('has HTTP status 504', () => {
		const err = new KubernetesTimeoutError('list helmreleases', 30_000);
		expect(err.code).toBe(504);
	});

	test('has reason GatewayTimeout', () => {
		const err = new KubernetesTimeoutError('list helmreleases', 30_000);
		expect(err.reason).toBe('GatewayTimeout');
	});

	test('includes operation and timeout in message', () => {
		const err = new KubernetesTimeoutError('get kustomization', 15_000);
		expect(err.message).toContain('15000ms');
		expect(err.message).toContain('get kustomization');
	});

	test('is an instance of KubernetesError', () => {
		const err = new KubernetesTimeoutError('list', 30_000);
		expect(err).toBeInstanceOf(KubernetesError);
	});
});

// ---------------------------------------------------------------------------
// handleK8sError — timeout detection
// ---------------------------------------------------------------------------

describe('handleK8sError — timeout detection', () => {
	test('returns KubernetesTimeoutError for AbortError by name', () => {
		const abortErr = new Error('The operation was aborted');
		abortErr.name = 'AbortError';
		const result = handleK8sError(abortErr, 'list resources', 30_000);
		expect(result).toBeInstanceOf(KubernetesTimeoutError);
		expect((result as KubernetesTimeoutError).code).toBe(504);
	});

	test('returns KubernetesTimeoutError for error with type=aborted', () => {
		const abortErr = Object.assign(new Error('aborted'), { type: 'aborted' });
		const result = handleK8sError(abortErr, 'get resource', 15_000);
		expect(result).toBeInstanceOf(KubernetesTimeoutError);
	});

	test('passes timeoutMs through to KubernetesTimeoutError', () => {
		const abortErr = new Error('abort');
		abortErr.name = 'AbortError';
		const result = handleK8sError(abortErr, 'list', 5_000) as KubernetesTimeoutError;
		expect(result.message).toContain('5000ms');
	});
});

// ---------------------------------------------------------------------------
// handleK8sError — existing error classification (regression)
// ---------------------------------------------------------------------------

describe('handleK8sError — existing error classification', () => {
	test('maps ECONNREFUSED to ClusterUnavailableError', () => {
		const err = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
		expect(handleK8sError(err, 'list')).toBeInstanceOf(ClusterUnavailableError);
	});

	test('maps ETIMEDOUT to ClusterUnavailableError', () => {
		const err = Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });
		expect(handleK8sError(err, 'list')).toBeInstanceOf(ClusterUnavailableError);
	});

	test('maps HTTP 404 to ResourceNotFoundError', () => {
		const err = Object.assign(new Error('Not Found'), { code: 404 });
		expect(handleK8sError(err, 'get resource')).toBeInstanceOf(ResourceNotFoundError);
	});

	test('maps HTTP 401 to AuthenticationError', () => {
		const err = Object.assign(new Error('Unauthorized'), { code: 401 });
		expect(handleK8sError(err, 'list')).toBeInstanceOf(AuthenticationError);
	});

	test('maps HTTP 403 to AuthorizationError', () => {
		const err = Object.assign(new Error('Forbidden'), { code: 403 });
		expect(handleK8sError(err, 'list')).toBeInstanceOf(AuthorizationError);
	});

	test('maps HTTP 503 to ClusterUnavailableError', () => {
		const err = Object.assign(new Error('Service Unavailable'), { code: 503 });
		expect(handleK8sError(err, 'list')).toBeInstanceOf(ClusterUnavailableError);
	});

	test('maps unknown errors to KubernetesError', () => {
		expect(handleK8sError(new Error('some weird error'), 'list')).toBeInstanceOf(KubernetesError);
	});

	test('maps non-Error to KubernetesError', () => {
		expect(handleK8sError('string error', 'list')).toBeInstanceOf(KubernetesError);
	});
});

// ---------------------------------------------------------------------------
// Timeout middleware integration — signal is set and fires after timeout
// ---------------------------------------------------------------------------

describe('_createTimeoutMiddleware — integration', () => {
	test('sets an AbortSignal on the RequestContext', async () => {
		const middleware = _createTimeoutMiddleware(500);
		const ctx = new k8s.RequestContext('https://example.com', k8s.HttpMethod.GET);
		expect(ctx.getSignal()).toBeUndefined();
		await middleware.pre(ctx);
		expect(ctx.getSignal()).toBeDefined();
		expect(ctx.getSignal()!.aborted).toBe(false);
	});

	test('signal aborts after the configured timeout elapses', async () => {
		const middleware = _createTimeoutMiddleware(50);
		const ctx = new k8s.RequestContext('https://example.com', k8s.HttpMethod.GET);
		await middleware.pre(ctx);
		const signal = ctx.getSignal()!;

		await new Promise<void>((resolve) => {
			signal.addEventListener('abort', () => resolve(), { once: true });
		});

		expect(signal.aborted).toBe(true);
	}, 1000);

	test('timer cleanup listener uses { once: true } — abort event does not fire twice', async () => {
		const middleware = _createTimeoutMiddleware(50);
		const ctx = new k8s.RequestContext('https://example.com', k8s.HttpMethod.GET);
		await middleware.pre(ctx);
		const signal = ctx.getSignal()!;

		let fireCount = 0;
		signal.addEventListener('abort', () => fireCount++);

		await new Promise<void>((resolve) => setTimeout(resolve, 150));
		expect(fireCount).toBe(1);
	}, 1000);
});
