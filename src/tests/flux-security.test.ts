/**
 * Security-focused tests for FluxCD resource handling.
 *
 * These tests validate the server-side validation logic directly, covering
 * apiVersion/kind mismatch detection, namespace validation, and YAML schema
 * restrictions — without requiring full SvelteKit route infrastructure.
 */
import { describe, test, expect } from 'bun:test';
import yaml from 'js-yaml';
import {
	getResourceDef,
	getResourceTypeByPlural,
	FLUX_RESOURCES
} from '../lib/server/kubernetes/flux/resources.js';

// ---------------------------------------------------------------------------
// apiVersion / kind mismatch logic (mirrors POST handler checks)
// ---------------------------------------------------------------------------

describe('POST apiVersion validation logic', () => {
	test('accepts correct apiVersion for GitRepository', () => {
		const resolvedType = getResourceTypeByPlural('gitrepositories')!;
		const resourceDef = getResourceDef(resolvedType)!;
		const bodyApiVersion = 'source.toolkit.fluxcd.io/v1';
		expect(bodyApiVersion).toBe(resourceDef.apiVersion);
	});

	test('detects apiVersion mismatch for GitRepository', () => {
		const resolvedType = getResourceTypeByPlural('gitrepositories')!;
		const resourceDef = getResourceDef(resolvedType)!;
		const wrongApiVersion = 'source.toolkit.fluxcd.io/v1beta2';
		expect(wrongApiVersion).not.toBe(resourceDef.apiVersion);
	});

	test('accepts correct apiVersion for HelmRelease', () => {
		const resolvedType = getResourceTypeByPlural('helmreleases')!;
		const resourceDef = getResourceDef(resolvedType)!;
		expect(resourceDef.apiVersion).toBe('helm.toolkit.fluxcd.io/v2');
		expect('helm.toolkit.fluxcd.io/v2').toBe(resourceDef.apiVersion);
	});

	test('detects apiVersion mismatch for HelmRelease (wrong group)', () => {
		const resolvedType = getResourceTypeByPlural('helmreleases')!;
		const resourceDef = getResourceDef(resolvedType)!;
		const wrongApiVersion = 'source.toolkit.fluxcd.io/v1';
		expect(wrongApiVersion).not.toBe(resourceDef.apiVersion);
	});

	test('all resource types have a defined apiVersion', () => {
		for (const [type, def] of Object.entries(FLUX_RESOURCES)) {
			expect(def.apiVersion).toBeTruthy();
			expect(def.apiVersion).toContain('/');
			// apiVersion should be group/version
			const [group, version] = def.apiVersion.split('/');
			expect(group).toBe(def.group);
			expect(version).toBe(def.version);
			void type;
		}
	});
});

// ---------------------------------------------------------------------------
// PUT kind validation logic (mirrors PUT handler checks)
// ---------------------------------------------------------------------------

describe('PUT kind validation logic', () => {
	test('kind matches resolved type for gitrepositories', () => {
		const resolvedType = getResourceTypeByPlural('gitrepositories')!;
		expect('GitRepository').toBe(resolvedType);
		expect('Kustomization').not.toBe(resolvedType);
	});

	test('kind matches resolved type for kustomizations', () => {
		const resolvedType = getResourceTypeByPlural('kustomizations')!;
		expect('Kustomization').toBe(resolvedType);
	});

	test('all resource definitions have kind matching their type key', () => {
		for (const [type, def] of Object.entries(FLUX_RESOURCES)) {
			expect(def.kind).toBe(type);
		}
	});
});

// ---------------------------------------------------------------------------
// Namespace validation (mirrors validateK8sNamespace regex)
// ---------------------------------------------------------------------------

// Inline the same regex used in validation.ts so we can unit-test the logic
// without importing the SvelteKit `error()` helper.
const K8S_NAME_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

describe('namespace validation logic', () => {
	test('accepts valid namespaces', () => {
		const valid = ['default', 'flux-system', 'my-namespace', 'a', 'ab', 'a1b2c3'];
		for (const ns of valid) {
			expect(K8S_NAME_REGEX.test(ns)).toBe(true);
		}
	});

	test('rejects invalid namespaces', () => {
		const invalid = [
			'',
			'UPPERCASE',
			'-leading-hyphen',
			'trailing-hyphen-',
			'has_underscore',
			'has.dot',
			'x'.repeat(64) // 64 chars — exceeds 63 char limit
		];
		for (const ns of invalid) {
			expect(K8S_NAME_REGEX.test(ns)).toBe(false);
		}
	});

	test('rejects namespace with slashes (path injection)', () => {
		expect(K8S_NAME_REGEX.test('flux-system/../admin')).toBe(false);
		expect(K8S_NAME_REGEX.test('ns/other')).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// YAML JSON_SCHEMA — verifies YAML-specific types are rejected
// ---------------------------------------------------------------------------

describe('YAML JSON_SCHEMA parsing', () => {
	test('parses plain YAML objects correctly', () => {
		const input = `
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-repo
  namespace: flux-system
spec:
  url: https://github.com/org/repo
`;
		const result = yaml.load(input, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>;
		expect(result.apiVersion).toBe('source.toolkit.fluxcd.io/v1');
		expect(result.kind).toBe('GitRepository');
	});

	test('rejects !!timestamp tag under JSON_SCHEMA', () => {
		const input = 'createdAt: !!timestamp 2024-01-01';
		expect(() => yaml.load(input, { schema: yaml.JSON_SCHEMA })).toThrow();
	});

	test('rejects !!binary tag under JSON_SCHEMA', () => {
		const input = 'data: !!binary aGVsbG8=';
		expect(() => yaml.load(input, { schema: yaml.JSON_SCHEMA })).toThrow();
	});

	test('bare date string is kept as string under JSON_SCHEMA', () => {
		// Without JSON_SCHEMA, "2024-01-01" would become a Date object.
		// With JSON_SCHEMA it stays a string.
		const input = 'date: 2024-01-01';
		const result = yaml.load(input, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>;
		expect(typeof result.date).toBe('string');
		expect(result.date).toBe('2024-01-01');
	});

	test('booleans and nulls parse as JSON equivalents', () => {
		const input = `
suspended: false
value: null
count: 42
`;
		const result = yaml.load(input, { schema: yaml.JSON_SCHEMA }) as Record<string, unknown>;
		expect(result.suspended).toBe(false);
		expect(result.value).toBeNull();
		expect(result.count).toBe(42);
	});
});
