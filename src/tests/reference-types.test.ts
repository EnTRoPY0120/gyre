import { describe, expect, test } from 'vitest';
import { resolveReferenceTypes } from '../lib/components/wizards/reference-types.js';

describe('resolveReferenceTypes', () => {
	test('resolves a type from a dependent form field', () => {
		expect(resolveReferenceTypes(undefined, 'sourceType', { sourceType: 'GitRepository' })).toEqual(
			['GitRepository']
		);
	});

	test('preserves explicit arrays and scalar types', () => {
		expect(resolveReferenceTypes(['GitRepository', 'Bucket'], undefined, {})).toEqual([
			'GitRepository',
			'Bucket'
		]);
		expect(resolveReferenceTypes('GitRepository', undefined, {})).toEqual(['GitRepository']);
	});

	test('returns no types when no source is configured', () => {
		expect(resolveReferenceTypes(undefined, undefined, {})).toEqual([]);
		expect(resolveReferenceTypes(undefined, 'sourceType', { sourceType: '' })).toEqual([]);
	});
});
