<script lang="ts">
	import { cn } from '#lib/utils.js';
	import type { TemplateField } from '#lib/templates/index.js';
	import * as Select from '#lib/components/ui/select/index.js';

	let {
		field,
		value,
		error,
		onValueChange
	}: {
		field: TemplateField;
		value: unknown;
		error?: string;
		onValueChange: (value: string) => void;
	} = $props();
</script>

<Select.Root type="single" value={String(value ?? '')} onValueChange={onValueChange}>
	<Select.Trigger id="field-{field.name}" class={cn('w-full', error && 'border-red-500')}>
		<Select.Value placeholder="Select {field.label}">
			{field.options?.find((option) => String(option.value) === String(value))?.label ||
				value ||
				`Select ${field.label}`}
		</Select.Value>
	</Select.Trigger>
	<Select.Content>
		{#each field.options || [] as option (option.value)}
			<Select.Item value={option.value}>{option.label}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
