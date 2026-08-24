<script lang="ts">
	import * as Select from '$lib/components/ui/select';
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

<Select.Root
	type="single"
	value={String(isRecord(item.val) ? (item.val[field.name] ?? '') : '')}
	onValueChange={(value) => onUpdateField(field.name, value)}
	{disabled}
>
	<Select.Trigger
		id="item-{item.id}-{field.name}"
		class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
	>
		<Select.Value placeholder="Select {field.label}">
			{#if isRecord(item.val)}
				{@const rec = item.val as Record<string, unknown>}
				{field.options?.find((option) => String(option.value) === String(rec[field.name]))?.label ??
					rec[field.name] ??
					`Select ${field.label}`}
			{:else}
				{`Select ${field.label}`}
			{/if}
		</Select.Value>
	</Select.Trigger>
	<Select.Content>
		{#each field.options || [] as option}
			<Select.Item value={option.value}>{option.label}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
