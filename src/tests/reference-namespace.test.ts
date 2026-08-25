import { describe, expect, test } from 'vitest';
import { getReferenceNamespaceUpdate } from '../lib/components/wizards/reference-namespace.js';
import type { TemplateField } from '../lib/templates/index.js';

function field(name: string, referenceNamespaceField?: string): TemplateField {
	return {
		name,
		label: name,
		path: name,
		type: 'string',
		referenceNamespaceField
	};
}

describe('getReferenceNamespaceUpdate', () => {
	test('returns no update when the reference has no namespace mapping', () => {
		expect(getReferenceNamespaceUpdate(field('source'), { namespace: 'team-a' }, [])).toBeNull();
		expect(
			getReferenceNamespaceUpdate(field('source', 'namespace'), undefined, [field('namespace')])
		).toBeNull();
	});

	test('targets an existing namespace field', () => {
		const namespaceField = field('namespace');

		expect(
			getReferenceNamespaceUpdate(field('source', 'namespace'), { namespace: 'team-a' }, [
				namespaceField
			])
		).toEqual({ fieldName: 'namespace', value: 'team-a', field: namespaceField });
	});

	test('preserves a fallback field name when the template field is absent', () => {
		expect(
			getReferenceNamespaceUpdate(field('source', 'missingNamespace'), { namespace: 'team-a' }, [])
		).toEqual({ fieldName: 'missingNamespace', value: 'team-a', field: undefined });
	});
});
