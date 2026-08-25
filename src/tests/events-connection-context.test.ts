import { describe, expect, test, vi } from 'vitest';
import { getEventConnectionContext } from '../routes/api/v1/events/connection-context.js';

describe('getEventConnectionContext', () => {
	test('uses the authenticated session and selected cluster', () => {
		const getClientAddress = vi.fn(() => '192.0.2.10');

		expect(getEventConnectionContext('user-1', 'cluster-a', 'session-1', getClientAddress)).toEqual(
			{
				clusterId: 'cluster-a',
				sessionId: 'session-1',
				userId: 'user-1'
			}
		);
		expect(getClientAddress).not.toHaveBeenCalled();
	});

	test('falls back to the in-cluster identity and client address', () => {
		const getClientAddress = vi.fn(() => '192.0.2.11');

		expect(getEventConnectionContext(42, undefined, undefined, getClientAddress)).toEqual({
			clusterId: 'in-cluster',
			sessionId: '192.0.2.11',
			userId: '42'
		});
		expect(getClientAddress).toHaveBeenCalledOnce();
	});
});
