<script lang="ts">
	import type { TemplateField } from '$lib/templates';
	import type { ReferenceOption } from './reference-fetch';
	import ArrayFieldObjectField from './ArrayFieldObjectField.svelte';

	let {
		item,
		itemFields,
		disabled = false,
		onUpdateField,
		onReferenceValueChange
	}: {
		item: { id: string; val: unknown };
		itemFields: TemplateField[];
		disabled?: boolean;
		onUpdateField: (fieldName: string, value: unknown) => void;
		onReferenceValueChange: (
		field: TemplateField,
		nextValue: string,
		selection?: ReferenceOption
		) => void;
	} = $props();

</script>

<div class="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
	<div class="grid gap-4 sm:grid-cols-2">
		{#each itemFields as field}
			<ArrayFieldObjectField
				{item}
				{field}
				{disabled}
				onUpdateField={onUpdateField}
				onReferenceValueChange={onReferenceValueChange}
			/>
		{/each}
	</div>
</div>
