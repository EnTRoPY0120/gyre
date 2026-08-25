import { describe, expect, test } from 'vitest';
import {
	AuthenticationError,
	ConfigurationError,
	KubernetesError,
	ResourceNotFoundError,
	errorToHttpResponse,
	handleApiError
} from '../lib/server/kubernetes/errors.js';

function captureThrown(callback: () => unknown): unknown {
	try {
		callback();
	} catch (error) {
		return error;
	}
	throw new Error('Expected callback to throw');
}

describe('errorToHttpResponse', () => {
	test('builds resource-not-found errors for each identifier shape', () => {
		expect(new ResourceNotFoundError('Deployment', 'default', 'api')).toMatchObject({
			message: 'Deployment not found: default/api',
			code: 404,
			reason: 'NotFound',
			name: 'ResourceNotFoundError'
		});
		expect(new ResourceNotFoundError('Deployment', 'default').message).toBe(
			'Deployment not found: default'
		);
		expect(new ResourceNotFoundError('Deployment').message).toBe('Deployment not found: resources');
	});

	test('maps Kubernetes errors and sanitizes their messages', () => {
		const result = errorToHttpResponse(
			new KubernetesError('Request failed at https://10.0.0.4/api?token=secret', 429, 'ApiError')
		);

		expect(result).toEqual({
			status: 429,
			body: {
				error: 'Request failed at [REDACTED URL]',
				code: 'ApiError'
			}
		});
	});

	test('maps configuration errors to a stable server response', () => {
		expect(errorToHttpResponse(new ConfigurationError('missing cluster config'))).toEqual({
			status: 500,
			body: { error: 'Configuration error', code: 'ConfigurationError' }
		});
	});

	test('preserves known HTTP error status and details', () => {
		expect(
			errorToHttpResponse({ status: 409, body: { message: 'Conflict', code: 'Conflict' } })
		).toEqual({
			status: 409,
			body: { error: 'Conflict', message: 'Conflict', code: 'Conflict' }
		});
	});

	test('uses a generic response for unknown errors', () => {
		expect(errorToHttpResponse(new Error('private database details'))).toEqual({
			status: 500,
			body: { error: 'An unexpected error occurred', code: 'InternalServerError' }
		});
		expect(errorToHttpResponse(new AuthenticationError())).toMatchObject({ status: 401 });
	});
});

describe('handleApiError', () => {
	test('returns a sanitized HTTP error for known Kubernetes failures', () => {
		const thrown = captureThrown(() =>
			handleApiError(
				new KubernetesError('API failed at https://10.0.0.4/api?token=secret', 429, 'ApiError'),
				'Fetching resources failed'
			)
		);

		expect(thrown).toMatchObject({
			status: 429,
			body: {
				message: 'API failed at [REDACTED URL]',
				code: 'ApiError'
			}
		});
	});

	test('hides raw Kubernetes error details behind a generic response', () => {
		expect(
			captureThrown(() => handleApiError(new Error('private cluster hostname')))
		).toMatchObject({
			status: 500,
			body: { message: 'Kubernetes operation failed', code: 'InternalServerError' }
		});
	});

	test('rethrows an existing HTTP error without replacing its response', () => {
		const httpError = { status: 409, body: { message: 'Conflict', code: 'Conflict' } };

		expect(captureThrown(() => handleApiError(httpError))).toBe(httpError);
	});
});
