<script lang="ts">
	import type { TemplateField } from '$lib/templates';

	let {
		item,
		field,
		disabled = false,
		onUpdateField
	}: {
		item: { id: string; val: unknown };
		field: TemplateField;
		disabled?: boolean;
		onUpdateField: (fieldName: string, value: unknown) => void;
	} = $props();

	function isRecord(val: unknown): val is Record<string, unknown> {
		return typeof val === 'object' && val !== null && !Array.isArray(val);
	}
</script>

<input
	id="item-{item.id}-{field.name}"
	type="text"
	value={isRecord(item.val) ? (item.val[field.name] ?? '') : ''}
	oninput={(event) => onUpdateField(field.name, (event.currentTarget as HTMLInputElement).value)}
	placeholder={field.placeholder}
	{disabled}
	class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
/>
