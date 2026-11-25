import { describe, expect, test, vi } from 'vitest';
import { normalizeError } from '../lib/utils/error-normalization.js';

vi.mock('#lib/server/logger.js', () => ({ logger: { error: vi.fn() } }));
vi.mock('#lib/server/kubernetes/errors.js', () => ({ errorToHttpResponse: vi.fn() }));
vi.mock('#lib/server/request/request-size.js', () => ({
	createPayloadTooLargeResponse: vi.fn(),
	isPayloadTooLargeError: vi.fn(() => false)
}));

import { normalizeHandleError } from '../lib/server/request/errors.js';

describe('normalizeError', () => {
	test('keeps allowed public codes and numeric status values', () => {
		expect(normalizeError({ code: 'NOT_FOUND', status: 404 })).toEqual({
			code: 'NOT_FOUND',
			status: 404
		});
	});

	test('falls back to UNKNOWN for untrusted error shapes', () => {
		expect(normalizeError({ code: 'DATABASE_PASSWORD', status: '500' })).toEqual({
			code: 'UNKNOWN',
			status: 500
		});
		expect(normalizeError(null)).toEqual({ code: 'UNKNOWN', status: 500 });
		expect(normalizeError('NOT_FOUND')).toEqual({ code: 'UNKNOWN', status: 500 });
	});

	test('preserves safe application and framework errors', () => {
		const event = { url: new URL('http://localhost/admin') };
		expect(
			normalizeHandleError({
				kind: 'app',
				error: { status: 403, message: 'Permission denied', code: 'NOT_AUTHORIZED' },
				event
			})
		).toEqual({ status: 403, message: 'Permission denied', code: 'NOT_AUTHORIZED' });

		expect(
			normalizeHandleError({
				kind: 'framework',
				error: { status: 404, message: 'Not Found' },
				event
			})
		).toEqual({ status: 404, message: 'Not Found', code: 'UNKNOWN' });
	});

	test('sanitizes unknown errors and always supplies a status', () => {
		expect(
			normalizeHandleError({
				kind: 'unknown',
				error: new Error('secret backend detail'),
				event: { url: new URL('http://localhost/admin'), locals: { requestId: 'request-1' } }
			})
		).toEqual({
			status: 500,
			message: 'An unexpected error occurred',
			code: 'UNKNOWN'
		});
	});
});
