import { describe, expect, test } from 'vitest';
import { getSystemShortcut } from '../lib/components/dashboard/system-shortcuts.js';

describe('getSystemShortcut', () => {
	const groups = [
		{ name: 'Sources', primaryRoute: 'gitrepositories', icon: 'git-branch' },
		{ name: 'Empty' },
		{ name: 'NoIcon', primaryRoute: 'custom' }
	];

	test('builds a resource route and uses the configured icon', () => {
		expect(getSystemShortcut(groups, 'Sources', '/fallback', 'fallback-icon')).toEqual({
			route: '/resources/gitrepositories',
			icon: 'git-branch'
		});
	});

	test('falls back when a group or its route/icon is incomplete', () => {
		expect(getSystemShortcut(groups, 'Missing', '/fallback', 'fallback-icon')).toEqual({
			route: '/fallback',
			icon: 'fallback-icon'
		});
		expect(getSystemShortcut(groups, 'Empty', '/fallback', 'fallback-icon')).toEqual({
			route: '/fallback',
			icon: 'fallback-icon'
		});
		expect(getSystemShortcut(groups, 'NoIcon', '/fallback', 'fallback-icon')).toEqual({
			route: '/resources/custom',
			icon: 'fallback-icon'
		});
	});
});
