import { describe, expect, test } from 'vitest';
import { validateFluxYaml } from '../lib/components/editors/flux-yaml-validation.js';

const severity = { Error: 8, Warning: 4 };

function messages(yaml: string): string[] {
	return validateFluxYaml(yaml, severity).map((marker) => marker.message);
}

describe('Flux YAML semantic validation', () => {
	test('returns no markers for a valid Kustomization', () => {
		expect(
			messages(`
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: app
spec:
  interval: 5m
  prune: true
  sourceRef:
    kind: GitRepository
    name: app
`)
		).toEqual([]);
	});

	test('reports api version and required metadata/spec fields', () => {
		expect(
			messages(`
apiVersion: kustomize.toolkit.fluxcd.io/v1beta1
kind: Kustomization
`)
		).toEqual([
			'Invalid apiVersion "kustomize.toolkit.fluxcd.io/v1beta1" for kind "Kustomization". Expected one of: kustomize.toolkit.fluxcd.io/v1, kustomize.toolkit.fluxcd.io/v1beta2',
			'Missing required field: "metadata"',
			'Missing required field: "spec"'
		]);
	});

	test('validates nested booleans, durations, and required fields', () => {
		const result = messages(`
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  labels: {}
spec:
  interval: invalid
  prune: maybe
  wait: true
  dependsOn:
    - name: app
  timeout: 4m
`);

		expect(result).toContain(
			'"interval" must be a duration string (e.g., 30s, 5m, 1h30m), got: "invalid"'
		);
		expect(result).toContain('"prune" must be a boolean (true or false), got: "maybe"');
		expect(result).toContain('Missing required spec field: "sourceRef"');
	});

	test('ignores unknown kinds and syntactically invalid YAML', () => {
		expect(messages('kind: Deployment\nmetadata: {}')).toEqual([]);
		expect(messages('kind: Kustomization\nmetadata: [')).toEqual([]);
	});
});
