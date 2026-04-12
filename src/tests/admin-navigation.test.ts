import { describe, expect, test } from 'bun:test';
import { ADMIN_HOME_FEATURES, getAdminSidebarLinks } from '../lib/navigation/admin.js';

describe('getAdminSidebarLinks', () => {
	test('returns admin recovery links for admins', () => {
		expect(getAdminSidebarLinks('admin').map((link) => link.href)).toEqual([
			'/admin/settings',
			'/admin/clusters',
			'/admin/auth-providers',
			'/admin/policies',
			'/admin/audit-logs',
			'/admin/backups',
			'/admin/users'
		]);
	});

	test('returns no admin links for non-admin roles', () => {
		expect(getAdminSidebarLinks('editor')).toEqual([]);
		expect(getAdminSidebarLinks('viewer')).toEqual([]);
	});
});

describe('ADMIN_HOME_FEATURES', () => {
	test('prioritizes recovery-critical destinations on the admin landing page', () => {
		expect(ADMIN_HOME_FEATURES.map((feature) => feature.href)).toEqual([
			'/admin/clusters',
			'/admin/settings',
			'/admin/auth-providers',
			'/admin/backups',
			'/admin/users',
			'/admin/policies',
			'/admin/audit-logs'
		]);
	});
});
