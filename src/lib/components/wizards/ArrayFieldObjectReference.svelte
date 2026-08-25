<script lang="ts">
	import type { TemplateField } from '$lib/templates';
	import ReferenceField from './ReferenceField.svelte';
	import type { ReferenceOption } from './reference-fetch';

	let {
		item,
		field,
		disabled = false,
		onReferenceValueChange
	}: {
		item: { id: string; val: unknown };
		field: TemplateField;
		disabled?: boolean;
		onReferenceValueChange: (
		field: TemplateField,
		nextValue: string,
		selection?: ReferenceOption
	) => void;
	} = $props();

	function isRecord(val: unknown): val is Record<string, unknown> {
		return typeof val === 'object' && val !== null && !Array.isArray(val);
	}
</script>

<ReferenceField
	id="item-{item.id}-{field.name}"
	value={String(isRecord(item.val) ? (item.val[field.name] ?? '') : '')}
	onValueChange={(nextValue, selection) => onReferenceValueChange(field, nextValue, selection)}
	referenceType={field.referenceType}
	referenceTypeField={field.referenceTypeField}
	referenceNamespace={field.referenceNamespaceField && isRecord(item.val)
		? String(item.val[field.referenceNamespaceField] ?? '')
		: ''}
	formValues={isRecord(item.val) ? item.val : {}}
	placeholder={field.placeholder}
	{disabled}
/>
