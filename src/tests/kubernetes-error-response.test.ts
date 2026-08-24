import { describe, expect, test } from 'vitest';
import {
	AuthenticationError,
	ConfigurationError,
	KubernetesError,
	errorToHttpResponse
} from '../lib/server/kubernetes/errors.js';

describe('errorToHttpResponse', () => {
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
