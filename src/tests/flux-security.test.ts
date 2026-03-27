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
import {
	K8S_NAME_REGEX,
	validateK8sNamespace,
	validateK8sName,
	validateLabelMap,
	validateSubstituteVars,
	validateFluxResourceSpec,
	CEL_PATTERN,
	LABEL_KEY_PATTERN,
	LABEL_VALUE_PATTERN,
	SUBSTITUTE_VAR_PATTERN
} from '../lib/server/validation.js';

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
			expect(def.kind).toBe(type as keyof typeof FLUX_RESOURCES);
		}
	});
});

// ---------------------------------------------------------------------------
// Namespace validation (mirrors validateK8sNamespace regex)
// ---------------------------------------------------------------------------

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
// validateK8sNamespace / validateK8sName — verify 400 is thrown on bad input
// ---------------------------------------------------------------------------

describe('validateK8sNamespace throws 400 on invalid input', () => {
	const invalidNamespaces = [
		'',
		'UPPERCASE',
		'-leading-hyphen',
		'trailing-hyphen-',
		'has_underscore',
		'has.dot',
		'flux-system/../admin',
		'ns/other',
		'x'.repeat(64)
	];

	for (const ns of invalidNamespaces) {
		test(`rejects namespace: "${ns.length > 20 ? ns.slice(0, 20) + '…' : ns}"`, () => {
			expect(() => validateK8sNamespace(ns)).toThrow();
			try {
				validateK8sNamespace(ns);
			} catch (e) {
				expect((e as { status: number }).status).toBe(400);
			}
		});
	}

	test('does not throw for valid namespaces', () => {
		for (const ns of ['default', 'flux-system', 'my-namespace', 'a']) {
			expect(() => validateK8sNamespace(ns)).not.toThrow();
		}
	});
});

describe('validateK8sName throws 400 on invalid input', () => {
	const invalidNames = ['', '-leading', 'trailing-', 'has space', 'x'.repeat(254)];

	for (const name of invalidNames) {
		test(`rejects name: "${name.length > 20 ? name.slice(0, 20) + '…' : name}"`, () => {
			expect(() => validateK8sName(name)).toThrow();
			try {
				validateK8sName(name);
			} catch (e) {
				expect((e as { status: number }).status).toBe(400);
			}
		});
	}

	test('does not throw for valid names', () => {
		for (const name of ['my-repo', 'flux.system', 'a1b2', 'my.resource.name']) {
			expect(() => validateK8sName(name)).not.toThrow();
		}
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

// ---------------------------------------------------------------------------
// Server-side spec validation (Item 1 of Issue #308)
// ---------------------------------------------------------------------------

describe('CEL_PATTERN validation', () => {
	test('accepts valid CEL expressions', () => {
		const valid = [
			'status.phase == "Running"',
			'metadata.name == "test"',
			'status.readyReplicas >= 1',
			'has(status.conditions)',
			'items[0].name'
		];
		for (const expr of valid) {
			expect(CEL_PATTERN.test(expr)).toBe(true);
		}
	});

	test('rejects CEL expressions with disallowed characters', () => {
		const invalid = [
			'$(whoami)',
			'`cat /etc/passwd`',
			'{{template}}',
			'; rm -rf /',
			'\\$(cat /etc/passwd)'
		];
		for (const expr of invalid) {
			expect(CEL_PATTERN.test(expr)).toBe(false);
		}
	});
});

describe('LABEL_KEY_PATTERN validation', () => {
	test('accepts valid label keys', () => {
		const valid = ['app', 'app.kubernetes.io/name', 'my-label', 'a'.repeat(63)];
		for (const key of valid) {
			expect(LABEL_KEY_PATTERN.test(key)).toBe(true);
		}
	});

	test('rejects label keys over 63 characters', () => {
		expect(LABEL_KEY_PATTERN.test('a'.repeat(64))).toBe(false);
		expect(LABEL_KEY_PATTERN.test('prefix/a'.repeat(32))).toBe(false);
	});

	test('rejects label keys with invalid characters', () => {
		const invalid = ['has/slash/inside', 'has spaces', 'has@special', 'has//doubleslash'];
		for (const key of invalid) {
			expect(LABEL_KEY_PATTERN.test(key)).toBe(false);
		}
	});
});

describe('LABEL_VALUE_PATTERN validation', () => {
	test('accepts valid label values', () => {
		const valid = ['production', 'v1.0.0', 'my_label', 'my-label', 'a'.repeat(63), ''];
		for (const val of valid) {
			expect(LABEL_VALUE_PATTERN.test(val)).toBe(true);
		}
	});

	test('rejects label values with disallowed chars', () => {
		const invalid = ['has/slash/inside', 'has spaces', 'has@special'];
		for (const val of invalid) {
			expect(LABEL_VALUE_PATTERN.test(val)).toBe(false);
		}
	});
});

describe('SUBSTITUTE_VAR_PATTERN validation', () => {
	test('accepts valid variable names', () => {
		const valid = ['CLUSTER_NAME', 'cluster_name', 'a', '_private', 'var123'];
		for (const v of valid) {
			expect(SUBSTITUTE_VAR_PATTERN.test(v)).toBe(true);
		}
	});

	test('rejects variable names starting with a digit', () => {
		expect(SUBSTITUTE_VAR_PATTERN.test('123var')).toBe(false);
		expect(SUBSTITUTE_VAR_PATTERN.test('1')).toBe(false);
	});

	test('rejects variable names with hyphens', () => {
		expect(SUBSTITUTE_VAR_PATTERN.test('cluster-name')).toBe(false);
	});
});

describe('validateLabelMap', () => {
	test('returns null for valid label maps', () => {
		expect(validateLabelMap({})).toBeNull();
		expect(validateLabelMap({ app: 'myapp' })).toBeNull();
		expect(validateLabelMap({ app: 'myapp', 'app.kubernetes.io/version': 'v1' })).toBeNull();
	});

	test('rejects label keys over 63 chars', () => {
		const result = validateLabelMap({ [('a' as string).repeat(64)]: 'value' });
		expect(result).not.toBeNull();
	});

	test('rejects label values with disallowed chars', () => {
		const result = validateLabelMap({ app: 'has spaces' });
		expect(result).not.toBeNull();
	});

	test('rejects non-object input', () => {
		expect(validateLabelMap('string')).not.toBeNull();
		expect(validateLabelMap([1, 2, 3])).not.toBeNull();
	});
});

describe('validateSubstituteVars', () => {
	test('returns null for valid substitute variables', () => {
		expect(validateSubstituteVars({})).toBeNull();
		expect(validateSubstituteVars({ CLUSTER_NAME: 'prod' })).toBeNull();
	});

	test('rejects variable names starting with a digit', () => {
		const result = validateSubstituteVars({ '123var': 'value' });
		expect(result).not.toBeNull();
	});

	test('rejects values over 1000 chars', () => {
		const longValue = 'a'.repeat(1001);
		const result = validateSubstituteVars({ myvar: longValue });
		expect(result).not.toBeNull();
	});

	test('rejects non-object input', () => {
		expect(validateSubstituteVars('string')).not.toBeNull();
	});
});

describe('validateFluxResourceSpec', () => {
	test('Kustomization: accepts valid CEL expressions', () => {
		const spec = {
			healthCheckExprs: [
				{ inProgress: 'status.phase == "Running"', current: 'status.readyReplicas >= 1' }
			]
		};
		expect(validateFluxResourceSpec('Kustomization', spec)).toBeNull();
	});

	test('Kustomization: rejects invalid CEL expressions', () => {
		const spec = {
			healthCheckExprs: [{ current: '$(whoami)' }]
		};
		const result = validateFluxResourceSpec('Kustomization', spec);
		expect(result).not.toBeNull();
	});

	test('Kustomization: accepts valid commonMetadata labels', () => {
		const spec = {
			commonMetadata: { labels: { app: 'myapp' } }
		};
		expect(validateFluxResourceSpec('Kustomization', spec)).toBeNull();
	});

	test('Kustomization: rejects invalid commonMetadata labels', () => {
		const spec = {
			commonMetadata: { labels: { invalid_key_: 'value' } }
		};
		const result = validateFluxResourceSpec('Kustomization', spec);
		expect(result).not.toBeNull();
	});

	test('Kustomization: accepts valid substitute variables', () => {
		const spec = {
			postBuild: { substitute: { CLUSTER_NAME: 'prod' } }
		};
		expect(validateFluxResourceSpec('Kustomization', spec)).toBeNull();
	});

	test('Kustomization: rejects invalid substitute variables', () => {
		const spec = {
			postBuild: { substitute: { '123invalid': 'value' } }
		};
		const result = validateFluxResourceSpec('Kustomization', spec);
		expect(result).not.toBeNull();
	});

	test('HelmRelease: accepts valid commonMetadata labels', () => {
		const spec = {
			commonMetadata: { labels: { app: 'myapp' } }
		};
		expect(validateFluxResourceSpec('HelmRelease', spec)).toBeNull();
	});

	test('HelmRelease: rejects invalid commonMetadata labels', () => {
		const spec = {
			commonMetadata: { labels: { 'Invalid Key': 'value' } }
		};
		const result = validateFluxResourceSpec('HelmRelease', spec);
		expect(result).not.toBeNull();
	});

	test('unknown resource type returns null', () => {
		expect(validateFluxResourceSpec('UnknownType', {})).toBeNull();
	});

	test('null/undefined spec returns null', () => {
		expect(
			validateFluxResourceSpec('Kustomization', null as unknown as Record<string, unknown>)
		).toBeNull();
		expect(
			validateFluxResourceSpec('Kustomization', undefined as unknown as Record<string, unknown>)
		).toBeNull();
	});
});
