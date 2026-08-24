import { describe, expect, test } from 'vitest';
import {
	shouldShowNotification,
	type NotificationPreferences
} from '../lib/stores/notification-preferences.js';

const defaults: NotificationPreferences = {
	enabled: true,
	resourceTypes: [],
	namespaces: [],
	events: ['success', 'failure', 'warning', 'info', 'error']
};

describe('shouldShowNotification', () => {
	test('allows matching events when notifications are enabled', () => {
		expect(shouldShowNotification(defaults, 'Kustomization', 'team-a', 'success')).toBe(true);
	});

	test('applies resource and namespace filters', () => {
		const prefs = { ...defaults, resourceTypes: ['Kustomization'], namespaces: ['team-a'] };
		expect(shouldShowNotification(prefs, 'Kustomization', 'team-a', 'info')).toBe(true);
		expect(shouldShowNotification(prefs, 'HelmRelease', 'team-a', 'info')).toBe(false);
		expect(shouldShowNotification(prefs, 'Kustomization', 'team-b', 'info')).toBe(false);
	});

	test('supports failure as the legacy alias for error events', () => {
		expect(
			shouldShowNotification({ ...defaults, events: ['failure'] }, 'Pod', 'default', 'error')
		).toBe(true);
		expect(
			shouldShowNotification({ ...defaults, events: ['warning'] }, 'Pod', 'default', 'error')
		).toBe(false);
	});

	test('rejects all events when notifications are disabled', () => {
		expect(
			shouldShowNotification({ ...defaults, enabled: false }, 'Pod', 'default', 'success')
		).toBe(false);
	});
});
