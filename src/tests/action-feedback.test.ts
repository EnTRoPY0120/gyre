import { describe, expect, test } from 'bun:test';
import { resolveResourceActionFeedback } from '../lib/components/flux/action-feedback.js';

describe('resolveResourceActionFeedback', () => {
	test('request failure rolls back optimistic state', () => {
		const result = resolveResourceActionFeedback({
			action: 'suspend',
			mutationError: new Error('Mutation failed')
		});

		expect(result.rollbackOptimistic).toBe(true);
		expect(result.tone).toBe('error');
		expect(result.message).toBe('Mutation failed');
	});

	test('invalidate failure after success does not roll back optimistic state', () => {
		const result = resolveResourceActionFeedback({
			action: 'resume',
			invalidateError: new Error('Refresh failed')
		});

		expect(result.rollbackOptimistic).toBe(false);
		expect(result.tone).toBe('warning');
		expect(result.message).toBe('Action applied, but refresh failed');
	});
});
