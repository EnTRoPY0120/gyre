import { describe, test, expect } from 'vitest';
import {
	getResourceDef,
	getResourceTypeByPlural,
	getAllResourceTypes,
	getAllResourcePlurals,
	resolveFluxResourceType,
	FLUX_RESOURCES
} from '../lib/server/kubernetes/flux/resources.js';

describe('getResourceDef', () => {
	test('returns correct definition for GitRepository', () => {
		const def = getResourceDef('GitRepository');
		expect(def).toBeDefined();
		expect(def?.kind).toBe('GitRepository');
		expect(def?.plural).toBe('gitrepositories');
		expect(def?.group).toBe('source.toolkit.fluxcd.io');
		expect(def?.version).toBe('v1');
		expect(def?.apiVersion).toBe('source.toolkit.fluxcd.io/v1');
		expect(def?.namespaced).toBe(true);
	});

	test('returns correct definition for HelmRelease', () => {
		const def = getResourceDef('HelmRelease');
		expect(def?.group).toBe('helm.toolkit.fluxcd.io');
		expect(def?.version).toBe('v2');
		expect(def?.plural).toBe('helmreleases');
		expect(def?.controller).toBe('helm-controller');
	});

	test('returns correct definition for Kustomization', () => {
		const def = getResourceDef('Kustomization');
		expect(def?.group).toBe('kustomize.toolkit.fluxcd.io');
		expect(def?.plural).toBe('kustomizations');
	});

	test('returns correct definition for notification controller resources', () => {
		expect(getResourceDef('Alert')?.group).toBe('notification.toolkit.fluxcd.io');
		expect(getResourceDef('Provider')?.group).toBe('notification.toolkit.fluxcd.io');
		expect(getResourceDef('Receiver')?.group).toBe('notification.toolkit.fluxcd.io');
	});

	test('returns correct definition for image automation resources', () => {
		expect(getResourceDef('ImageRepository')?.group).toBe('image.toolkit.fluxcd.io');
		expect(getResourceDef('ImagePolicy')?.group).toBe('image.toolkit.fluxcd.io');
		expect(getResourceDef('ImageUpdateAutomation')?.controller).toBe('image-automation-controller');
	});

	test('returns undefined for unknown resource type', () => {
		expect(getResourceDef('UnknownResource')).toBeUndefined();
		expect(getResourceDef('')).toBeUndefined();
		expect(getResourceDef('gitrepositories')).toBeUndefined(); // plural, not kind
	});

	test('returns definitions for all 13 resource types', () => {
		const types = [
			'GitRepository',
			'HelmRepository',
			'HelmChart',
			'Bucket',
			'OCIRepository',
			'Kustomization',
			'HelmRelease',
			'Alert',
			'Provider',
			'Receiver',
			'ImageRepository',
			'ImagePolicy',
			'ImageUpdateAutomation'
		];
		for (const type of types) {
			expect(getResourceDef(type)).toBeDefined();
		}
	});
});

describe('getResourceTypeByPlural', () => {
	test('maps gitrepositories to GitRepository', () => {
		expect(getResourceTypeByPlural('gitrepositories')).toBe('GitRepository');
	});

	test('maps helmreleases to HelmRelease', () => {
		expect(getResourceTypeByPlural('helmreleases')).toBe('HelmRelease');
	});

	test('maps kustomizations to Kustomization', () => {
		expect(getResourceTypeByPlural('kustomizations')).toBe('Kustomization');
	});

	test('maps imageupdateautomations to ImageUpdateAutomation', () => {
		expect(getResourceTypeByPlural('imageupdateautomations')).toBe('ImageUpdateAutomation');
	});

	test('returns undefined for unknown plural', () => {
		expect(getResourceTypeByPlural('unknownresources')).toBeUndefined();
		expect(getResourceTypeByPlural('GitRepository')).toBeUndefined(); // kind, not plural
		expect(getResourceTypeByPlural('')).toBeUndefined();
	});

	test('bidirectional: consistent with getResourceDef', () => {
		for (const [type, def] of Object.entries(FLUX_RESOURCES)) {
			expect(getResourceTypeByPlural(def.plural)).toBe(type);
		}
	});
});

describe('resolveFluxResourceType', () => {
	test('returns canonical kind when a kind is provided', () => {
		expect(resolveFluxResourceType('Kustomization')).toBe('Kustomization');
		expect(resolveFluxResourceType('GitRepository')).toBe('GitRepository');
	});

	test('resolves plural route params to canonical kinds', () => {
		expect(resolveFluxResourceType('kustomizations')).toBe('Kustomization');
		expect(resolveFluxResourceType('gitrepositories')).toBe('GitRepository');
	});

	test('returns undefined for unknown identifiers', () => {
		expect(resolveFluxResourceType('unknownresources')).toBeUndefined();
		expect(resolveFluxResourceType('')).toBeUndefined();
	});

	test('resolves every supported kind and plural', () => {
		for (const [type, def] of Object.entries(FLUX_RESOURCES)) {
			expect(resolveFluxResourceType(type)).toBe(type);
			expect(resolveFluxResourceType(def.plural)).toBe(type);
		}
	});
});

describe('getAllResourceTypes', () => {
	test('returns exactly 13 resource types', () => {
		expect(getAllResourceTypes()).toHaveLength(13);
	});

	test('includes all expected types', () => {
		const types = getAllResourceTypes();
		expect(types).toContain('GitRepository');
		expect(types).toContain('HelmRelease');
		expect(types).toContain('Kustomization');
		expect(types).toContain('ImageUpdateAutomation');
		expect(types).toContain('Alert');
		expect(types).toContain('Provider');
		expect(types).toContain('Receiver');
	});

	test('all returned types resolve via getResourceDef', () => {
		for (const type of getAllResourceTypes()) {
			expect(getResourceDef(type)).toBeDefined();
		}
	});
});

describe('getAllResourcePlurals', () => {
	test('returns exactly 13 plural names', () => {
		expect(getAllResourcePlurals()).toHaveLength(13);
	});

	test('all plurals are lowercase', () => {
		for (const plural of getAllResourcePlurals()) {
			expect(plural).toBe(plural.toLowerCase());
		}
	});

	test('contains expected plurals', () => {
		const plurals = getAllResourcePlurals();
		expect(plurals).toContain('gitrepositories');
		expect(plurals).toContain('helmreleases');
		expect(plurals).toContain('kustomizations');
		expect(plurals).toContain('imageupdateautomations');
	});

	test('all plurals are unique', () => {
		const plurals = getAllResourcePlurals();
		expect(new Set(plurals).size).toBe(plurals.length);
	});

	test('all plurals resolve via getResourceTypeByPlural', () => {
		for (const plural of getAllResourcePlurals()) {
			expect(getResourceTypeByPlural(plural)).toBeDefined();
		}
	});
});
