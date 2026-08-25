import { describe, expect, test } from 'vitest';
import {
	buildNotification,
	getNotificationKey,
	getNotificationMessage,
	getNotificationState,
	getNotificationStateChangeMessage,
	getNotificationTitle,
	getNotificationType,
	getEventControlAction,
	isDuplicateNotification,
	prepareNotification,
	parseStoredNotificationState
} from '../lib/stores/events/helpers.js';
import type { ResourceEvent } from '../lib/stores/events/types.js';

const event: ResourceEvent = {
	type: 'MODIFIED',
	clusterId: 'cluster-a',
	resourceType: 'Kustomization',
	timestamp: '2026-08-21T00:00:00.000Z',
	resource: {
		metadata: { name: 'app', namespace: 'flux-system', uid: 'uid' },
		status: {
			conditions: [
				{ type: 'Ready', status: 'False', reason: 'ReconciliationFailed', message: 'failed' }
			]
		}
	}
};

describe('notification helpers', () => {
	test('normalizes valid stored state and rejects malformed entries', () => {
		const result = parseStoredNotificationState({
			sessionId: 'session-1',
			entries: [
				['valid', { revision: 'rev-1', messagePreview: 'ok' }],
				['bad', { revision: 42 }],
				['also-bad', 'state']
			]
		});

		expect(result).toEqual({
			sessionId: 'session-1',
			entries: [
				[
					'valid',
					{
						revision: 'rev-1',
						readyStatus: undefined,
						readyReason: undefined,
						messagePreview: 'ok'
					}
				]
			]
		});
		expect(parseStoredNotificationState([['legacy', 'value']])).toEqual({ entries: [] });
	});

	test('derives stable notification metadata from a resource event', () => {
		expect(getNotificationKey(event, 'cluster-a')).toBe('cluster-a/Kustomization/flux-system/app');
		expect(getNotificationType(event)).toBe('warning');
		expect(getNotificationTitle(event)).toBe('Kustomization Updated');
		expect(getNotificationMessage(event)).toBe('app in flux-system: failed');
		expect(getNotificationState(event, 20)).toEqual({
			revision: undefined,
			readyStatus: 'False',
			readyReason: 'ReconciliationFailed',
			messagePreview: 'failed'
		});
	});

	test('classifies SSE control messages without applying store side effects', () => {
		expect(getEventControlAction({ ...event, type: 'HEARTBEAT' }, null)).toEqual({
			type: 'heartbeat'
		});
		expect(
			getEventControlAction(
				{ ...event, type: 'CONNECTED', serverSessionId: 'session-2' },
				'session-1'
			)
		).toEqual({ type: 'connected', sessionChanged: true, sessionId: 'session-2' });
		expect(
			getEventControlAction({ ...event, type: 'SHUTDOWN', reason: 'server_shutdown' }, null)
		).toEqual({
			type: 'shutdown',
			permanent: true
		});
	});

	test('identifies unchanged modifications and builds unread notifications', () => {
		const state = getNotificationState(event, 20);

		expect(isDuplicateNotification(event, state, state)).toBe(true);
		expect(isDuplicateNotification({ ...event, type: 'ADDED' }, state, state)).toBe(false);

		const notification = buildNotification(event, 'cluster-a', 'warning');
		expect(notification).toMatchObject({
			clusterId: 'cluster-a',
			type: 'warning',
			title: 'Kustomization Updated',
			message: 'app in flux-system: failed',
			resourceType: 'Kustomization',
			resourceName: 'app',
			resourceNamespace: 'flux-system',
			read: false
		});
		expect(notification.id).toEqual(expect.any(String));
		expect(notification.timestamp).toEqual(expect.any(Date));
	});

	test('prepares eligible notification candidates without mutating state', () => {
		const states = new Map();
		const candidate = prepareNotification(event, states, () => true, 20, 'in-cluster');

		expect(candidate).toMatchObject({
			clusterId: 'cluster-a',
			resourceKey: 'cluster-a/Kustomization/flux-system/app',
			type: 'warning',
			isDuplicate: false
		});
		expect(states).toHaveLength(0);
	});

	test('filters ineligible events and identifies duplicate modifications', () => {
		const states = new Map();
		const currentState = getNotificationState(event, 20);
		states.set('cluster-a/Kustomization/flux-system/app', currentState);

		expect(prepareNotification(event, states, () => false, 20, 'in-cluster')).toBeNull();
		expect(prepareNotification(event, states, () => true, 20, 'in-cluster')).toMatchObject({
			isDuplicate: true,
			previousState: currentState
		});
	});

	test('formats new and changed notification state log messages', () => {
		const currentState = getNotificationState(event, 20);
		const newCandidate = prepareNotification(event, new Map(), () => true, 20, 'in-cluster');
		expect(newCandidate).not.toBeNull();
		if (!newCandidate) throw new Error('Expected a notification candidate');
		expect(getNotificationStateChangeMessage(event, newCandidate)).toBe(
			'[Notification] New notification for cluster-a/Kustomization/flux-system/app: MODIFIED, revision: none'
		);

		const changedCandidate = {
			...newCandidate,
			previousState: { ...currentState, revision: 'rev-1' }
		};
		expect(getNotificationStateChangeMessage(event, changedCandidate)).toContain(
			'[Notification] State change for cluster-a/Kustomization/flux-system/app: revision "rev-1" -> "none"'
		);
	});
});
