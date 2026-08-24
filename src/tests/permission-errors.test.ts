import { error as httpError } from '@sveltejs/kit';
import { describe, expect, test } from 'vitest';
import { isPermissionErrorLike } from '../lib/server/http/permission-errors.js';
import { AuthorizationError } from '../lib/server/kubernetes/errors.js';
import { RbacError } from '../lib/server/rbac.js';

describe('permission error classification', () => {
	test('recognizes HTTP, domain, and serialized permission errors', () => {
		const http403 = captureThrow(() => httpError(403, { message: 'forbidden' }));

		expect(isPermissionErrorLike(http403)).toBe(true);
		expect(isPermissionErrorLike(new RbacError('denied', 'read'))).toBe(true);
		expect(isPermissionErrorLike(new AuthorizationError())).toBe(true);
		expect(isPermissionErrorLike({ status: '401' })).toBe(true);
		expect(isPermissionErrorLike({ code: 403 })).toBe(true);
		expect(isPermissionErrorLike({ code: 'FORBIDDEN' })).toBe(true);
		expect(isPermissionErrorLike({ name: 'AuthorizationError' })).toBe(true);
	});

	test('does not swallow unrelated failures', () => {
		expect(isPermissionErrorLike(new Error('network failure'))).toBe(false);
		expect(isPermissionErrorLike({ status: 500 })).toBe(false);
		expect(isPermissionErrorLike({ code: 'timeout' })).toBe(false);
		expect(isPermissionErrorLike(null)).toBe(false);
	});
});

function captureThrow(callback: () => never): unknown {
	try {
		callback();
	} catch (thrown) {
		return thrown;
	}
	throw new Error('Expected callback to throw');
}
