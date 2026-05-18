import { describe, expect, test } from 'vitest';
import {
	getResourceInfoByKind,
	resolveResourceKind,
	resolveResourceRouteType
} from '../lib/config/resources.js';

describe('resource config helpers', () => {
	test('resolves canonical kinds to route types', () => {
		expect(resolveResourceRouteType('GitRepository')).toBe('gitrepositories');
		expect(resolveResourceRouteType('Kustomization')).toBe('kustomizations');
	});

	test('resolves route types back to canonical kinds', () => {
		expect(resolveResourceKind('gitrepositories')).toBe('GitRepository');
		expect(resolveResourceKind('helmreleases')).toBe('HelmRelease');
	});

	test('looks up resource info by canonical kind', () => {
		const resourceInfo = getResourceInfoByKind('ImageRepository');

		expect(resourceInfo?.type).toBe('imagerepositories');
		expect(resourceInfo?.displayName).toBe('Image Repositories');
	});

	test('returns null for unknown identifiers', () => {
		expect(resolveResourceRouteType('NotAResource')).toBeNull();
		expect(resolveResourceKind('still-not-real')).toBeNull();
		expect(getResourceInfoByKind('DefinitelyFake')).toBeNull();
	});
});
