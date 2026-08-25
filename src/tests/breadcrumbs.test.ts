import { describe, expect, test } from 'vitest';
import { buildBreadcrumbs } from '../lib/components/layout/breadcrumbs.js';

describe('buildBreadcrumbs', () => {
	test('builds the dashboard breadcrumb for the root path', () => {
		expect(buildBreadcrumbs('/')).toEqual([{ label: 'Dashboard', href: '/' }]);
	});

	test('builds resource list and detail trails', () => {
		expect(buildBreadcrumbs('/resources/kustomizations')).toEqual([
			{ label: 'Dashboard', href: '/' },
			{ label: 'Kustomizations', href: '/resources/kustomizations' }
		]);
		expect(buildBreadcrumbs('/resources/kustomizations/flux-system/app')).toEqual([
			{ label: 'Dashboard', href: '/' },
			{ label: 'Kustomizations', href: '/resources/kustomizations' },
			{ label: 'flux-system/app', href: '/resources/kustomizations/flux-system/app' }
		]);
	});

	test('builds admin, create, and password trails', () => {
		expect(buildBreadcrumbs('/admin/auth-providers')).toEqual([
			{ label: 'Dashboard', href: '/' },
			{ label: 'Administration', href: '/admin' },
			{ label: 'Auth Providers', href: '/admin/auth-providers' }
		]);
		expect(buildBreadcrumbs('/create/helmrelease')).toEqual([
			{ label: 'Dashboard', href: '/' },
			{ label: 'Create Resource', href: '/create' },
			{ label: 'helmrelease', href: '/create/helmrelease' }
		]);
		expect(buildBreadcrumbs('/change-password')).toEqual([
			{ label: 'Dashboard', href: '/' },
			{ label: 'Change Password', href: '/change-password' }
		]);
	});

	test('uses raw labels for unknown sections and admin pages', () => {
		expect(buildBreadcrumbs('/admin/unknown')).toEqual([
			{ label: 'Dashboard', href: '/' },
			{ label: 'Administration', href: '/admin' },
			{ label: 'unknown', href: '/admin/unknown' }
		]);
		expect(buildBreadcrumbs('/settings')).toEqual([{ label: 'Dashboard', href: '/' }]);
	});
});
