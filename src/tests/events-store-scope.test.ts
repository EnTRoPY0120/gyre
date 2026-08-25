import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { importFresh } from './helpers/import-fresh';
import type { NotificationStorage } from '../lib/stores/events/storage.js';

type EventsModule = typeof import('../lib/stores/events.svelte.js');

let storage: NotificationStorage;
let values: Map<string, string>;
let getCalls: string[];
let eventsStore: EventsModule['eventsStore'];
let previousWindow: typeof globalThis.window | undefined;
let previousLocalStorage: typeof globalThis.localStorage | undefined;

beforeEach(async () => {
	vi.resetModules();
	values = new Map();
	getCalls = [];
	storage = {
		getItem: (key) => {
			getCalls.push(key);
			if (key.startsWith('gyre_notifications_cluster-a_')) {
				return JSON.stringify([
					{
						id: 'restored',
						clusterId: 'cluster-a',
						type: 'info',
						title: 'Restored',
						message: 'from scoped storage',
						timestamp: '2026-01-01T00:00:00.000Z',
						read: false
					}
				]);
			}
			return values.get(key) ?? null;
		},
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key)
	};

	previousWindow = globalThis.window;
	previousLocalStorage = globalThis.localStorage;
	Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
	Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

	eventsStore = (await importFresh<EventsModule>('../lib/stores/events.svelte.js')).eventsStore;
});

afterEach(() => {
	if (previousWindow === undefined) delete (globalThis as { window?: unknown }).window;
	else Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
	if (previousLocalStorage === undefined)
		delete (globalThis as { localStorage?: unknown }).localStorage;
	else
		Object.defineProperty(globalThis, 'localStorage', {
			configurable: true,
			value: previousLocalStorage
		});
	vi.restoreAllMocks();
	vi.resetModules();
});

describe('eventsStore.setStorageScope', () => {
	test('clears stale state and restores notifications for the new cluster and user', () => {
		eventsStore.setStorageScope({ clusterId: 'cluster-a', userIdentity: 'user-1' });

		expect(eventsStore.notifications).toHaveLength(1);
		expect(eventsStore.notifications[0]?.id).toBe('restored');
		expect(getCalls.some((key) => key.startsWith('gyre_notifications_cluster-a_'))).toBe(true);
	});

	test('does not reload storage when the normalized scope is unchanged', () => {
		eventsStore.setStorageScope({ clusterId: 'cluster-a', userIdentity: 'user-1' });
		const readsAfterFirstScopeChange = getCalls.length;

		eventsStore.setStorageScope({ clusterId: 'cluster-a', userIdentity: 'user-1' });

		expect(getCalls).toHaveLength(readsAfterFirstScopeChange);
	});

	test('normalizes the default cluster and clears the user scope when omitted', () => {
		eventsStore.setStorageScope({ clusterId: 'cluster-a', userIdentity: 'user-1' });

		eventsStore.setStorageScope({ clusterId: 'default' });

		expect(eventsStore.notifications).toEqual([]);
	});
});
