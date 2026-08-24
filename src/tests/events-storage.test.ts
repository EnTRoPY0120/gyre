import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
	loadNotificationStorage,
	saveNotificationStorage,
	type NotificationStorage
} from '../lib/stores/events/storage.js';
import type { NotificationMessage } from '../lib/stores/events/types.js';

const keys = { notifications: 'notifications', state: 'state' };

function createStorage(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	const storage: NotificationStorage = {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key)
	};
	return { storage, values };
}

function createNotification(id: string): NotificationMessage {
	return {
		id,
		clusterId: 'cluster-a',
		type: 'info',
		title: 'Updated',
		message: id,
		timestamp: new Date('2026-01-01T00:00:00.000Z'),
		read: false
	};
}

const logger = {
	warn: vi.fn(),
	error: vi.fn()
};

describe('notification storage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('restores notification dates and persisted deduplication state', () => {
		const { storage } = createStorage({
			notifications: JSON.stringify([
				{ ...createNotification('n1'), timestamp: '2026-01-01T00:00:00.000Z' }
			]),
			state: JSON.stringify({
				sessionId: 'session-1',
				entries: [['cluster-a/Pod/default/demo', { revision: 'r1' }]]
			})
		});

		const restored = loadNotificationStorage(storage, keys, logger);

		expect(restored.notifications[0]?.timestamp).toEqual(new Date('2026-01-01T00:00:00.000Z'));
		expect(restored.state).toEqual({
			sessionId: 'session-1',
			entries: [
				[
					'cluster-a/Pod/default/demo',
					{
						revision: 'r1',
						readyStatus: undefined,
						readyReason: undefined,
						messagePreview: ''
					}
				]
			]
		});
	});

	test('clears both records when persisted notification JSON is corrupted', () => {
		const { storage, values } = createStorage({ notifications: '{bad-json', state: '{bad-json' });

		const restored = loadNotificationStorage(storage, keys, logger);

		expect(restored).toEqual({ notifications: [], state: { entries: [] } });
		expect(values.has(keys.notifications)).toBe(false);
		expect(values.has(keys.state)).toBe(false);
		expect(logger.error).toHaveBeenCalledOnce();
	});

	test('persists the bounded notification list and state session', () => {
		const { storage, values } = createStorage();
		const notifications = [
			createNotification('n1'),
			createNotification('n2'),
			createNotification('n3')
		];

		saveNotificationStorage({
			storage,
			keys,
			notifications,
			state: new Map([['resource', { revision: 'r1', messagePreview: 'ready' }]]),
			sessionId: 'session-1',
			logger,
			maxNotifications: 2
		});

		expect(JSON.parse(values.get(keys.notifications) ?? '')).toHaveLength(2);
		expect(JSON.parse(values.get(keys.state) ?? '')).toEqual({
			sessionId: 'session-1',
			entries: [['resource', { revision: 'r1', messagePreview: 'ready' }]]
		});
	});

	test('saves a reduced list after a quota error and removes stale state', () => {
		const { storage, values } = createStorage({ state: 'stale' });
		let writes = 0;
		const quotaStorage: NotificationStorage = {
			...storage,
			setItem: (key, value) => {
				writes++;
				if (writes === 1) throw new DOMException('Storage full', 'QuotaExceededError');
				storage.setItem(key, value);
			}
		};

		saveNotificationStorage({
			storage: quotaStorage,
			keys,
			notifications: [createNotification('n1'), createNotification('n2'), createNotification('n3')],
			state: new Map(),
			sessionId: null,
			logger,
			maxNotifications: 3
		});

		expect(JSON.parse(values.get(keys.notifications) ?? '')).toHaveLength(1);
		expect(values.has(keys.state)).toBe(false);
		expect(logger.warn).toHaveBeenCalledWith(
			'[Storage] localStorage quota exceeded, saved reduced notification set'
		);
	});
});
