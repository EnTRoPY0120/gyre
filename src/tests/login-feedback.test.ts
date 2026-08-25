import { describe, expect, test } from 'vitest';
import { getLoginQueryFeedback } from '../lib/auth/login-feedback.js';

describe('getLoginQueryFeedback', () => {
	test('reports logout feedback and clears the query marker', () => {
		expect(getLoginQueryFeedback(new URLSearchParams('loggedOut=true'))).toEqual({
			loggedOut: true,
			errorMessage: null,
			shouldClear: true
		});
	});

	test('decodes an error message and requests cleanup', () => {
		expect(getLoginQueryFeedback(new URLSearchParams('error=Provider%20unavailable'))).toEqual({
			loggedOut: false,
			errorMessage: 'Provider unavailable',
			shouldClear: true
		});
	});

	test('does not request cleanup when no feedback is present', () => {
		expect(getLoginQueryFeedback(new URLSearchParams())).toEqual({
			loggedOut: false,
			errorMessage: null,
			shouldClear: false
		});
	});
});
