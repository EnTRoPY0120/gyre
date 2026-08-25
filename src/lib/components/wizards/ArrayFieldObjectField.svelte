<script lang="ts">
	import type { TemplateField } from '$lib/templates';
	import ArrayFieldObjectReference from './ArrayFieldObjectReference.svelte';
	import ArrayFieldObjectSelect from './ArrayFieldObjectSelect.svelte';
	import ArrayFieldObjectTextInput from './ArrayFieldObjectTextInput.svelte';
	import type { ReferenceOption } from './reference-fetch';

	let {
		item,
		field,
		disabled = false,
		onUpdateField,
		onReferenceValueChange
	}: {
		item: { id: string; val: unknown };
		field: TemplateField;
		disabled?: boolean;
		onUpdateField: (fieldName: string, value: unknown) => void;
		onReferenceValueChange: (
		field: TemplateField,
		nextValue: string,
		selection?: ReferenceOption
		) => void;
	} = $props();
</script>

<div class="flex flex-col gap-1.5">
	<label class="text-xs font-medium text-zinc-400" for="item-{item.id}-{field.name}">
		{field.label}
		{#if field.required}<span class="text-red-500">*</span>{/if}
	</label>
	{#if field.referenceType || field.referenceTypeField}
		<ArrayFieldObjectReference
			{item}
			{field}
			{disabled}
			onReferenceValueChange={onReferenceValueChange}
		/>
	{:else if field.type === 'select'}
		<ArrayFieldObjectSelect {item} {field} {disabled} onUpdateField={onUpdateField} />
	{:else}
		<ArrayFieldObjectTextInput {item} {field} {disabled} onUpdateField={onUpdateField} />
	{/if}
</div>
