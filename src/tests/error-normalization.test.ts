import { describe, expect, test } from 'vitest';
import { normalizeError } from '../lib/utils/error-normalization.js';

describe('normalizeError', () => {
	test('keeps allowed public codes and numeric status values', () => {
		expect(normalizeError({ code: 'NOT_FOUND', status: 404 })).toEqual({
			code: 'NOT_FOUND',
			status: 404
		});
	});

	test('falls back to UNKNOWN for untrusted error shapes', () => {
		expect(normalizeError({ code: 'DATABASE_PASSWORD', status: '500' })).toEqual({
			code: 'UNKNOWN'
		});
		expect(normalizeError(null)).toEqual({ code: 'UNKNOWN' });
		expect(normalizeError('NOT_FOUND')).toEqual({ code: 'UNKNOWN' });
	});
});
