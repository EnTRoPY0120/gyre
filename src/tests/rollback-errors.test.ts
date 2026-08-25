import { describe, expect, test } from 'vitest';
import { sanitizeRollbackError } from '../lib/server/flux/use-cases/rollback-errors.js';

describe('rollback error audit messages', () => {
	test('sanitizes sensitive details from Error messages', () => {
		expect(sanitizeRollbackError(new Error('fetch https://10.0.0.4/api?token=secret'))).toBe(
			'fetch [REDACTED URL]'
		);
	});

	test('handles non-Error thrown values', () => {
		expect(sanitizeRollbackError('rollback failed')).toBe('rollback failed');
	});
});
