import { describe, expect, test } from 'vitest';
import {
	coerceWizardFieldValue,
	validateWizardField
} from '../lib/components/wizards/field-validation.js';
import { validateHelmReleaseResourceValues } from '../lib/components/wizards/helm-release-validation.js';
import type { ResourceTemplate, TemplateField } from '../lib/templates/types.js';

const numberField: TemplateField = {
	name: 'replicas',
	label: 'Replicas',
	path: 'spec.replicas',
	type: 'number',
	required: true,
	validation: { min: 1, max: 3 }
};

describe('wizard field validation', () => {
	test('coerces numeric input while keeping invalid values empty', () => {
		expect(coerceWizardFieldValue(numberField, '2')).toBe(2);
		expect(coerceWizardFieldValue(numberField, 'not-a-number')).toBeUndefined();
		expect(coerceWizardFieldValue({ ...numberField, type: 'string' }, '2')).toBe('2');
	});

	test('validates required and numeric range rules', () => {
		expect(validateWizardField(numberField, undefined, true)).toBe('Replicas is required');
		expect(validateWizardField(numberField, 0, true)).toBeNull();
		expect(validateWizardField(numberField, -1, true)).toBe('Replicas must be at least 1');
		expect(validateWizardField(numberField, 4, true)).toBe('Replicas must be at most 3');
		expect(validateWizardField(numberField, 2, false)).toBeNull();
	});

	test('validates safe patterns and preserves custom messages', () => {
		const field: TemplateField = {
			name: 'hostname',
			label: 'Hostname',
			path: 'spec.hostname',
			type: 'string',
			validation: { pattern: '^[a-z]+$', message: 'Use lowercase letters only' }
		};
		expect(validateWizardField(field, 'valid', true)).toBeNull();
		expect(validateWizardField(field, 'INVALID', true)).toBe('Use lowercase letters only');
		expect(validateWizardField(field, '', true)).toBeNull();
	});

	test('rejects invalid and unsafe regular expressions', () => {
		const invalid = {
			...numberField,
			type: 'string' as const,
			validation: { pattern: '[' }
		};
		const unsafe = {
			...numberField,
			type: 'string' as const,
			validation: { pattern: ['(', 'a+', ')+$'].join('') }
		};
		expect(validateWizardField(invalid, 'value', true)).toBe(
			'Invalid validation pattern for Replicas'
		);
		expect(validateWizardField(unsafe, 'value', true)).toBe(
			'Invalid validation pattern for Replicas'
		);
	});

	test('detects conflicting HelmRelease resource values', () => {
		const template = { kind: 'HelmRelease' } as ResourceTemplate;
		expect(
			validateHelmReleaseResourceValues(template, {
				resourceRequestsCpu: '100m',
				values: 'resources:\n  limits:\n    cpu: 1'
			})
		).toContain('Remove resources');
		expect(validateHelmReleaseResourceValues(template, { resourceRequestsCpu: '100m' })).toBeNull();
	});
});
