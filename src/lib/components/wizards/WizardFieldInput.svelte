<script lang="ts">
	import { cn } from '$lib/utils';
	import type { TemplateField } from '$lib/templates';

	let {
		field,
		value,
		error,
		onValueChange,
		onCommit
	}: {
		field: TemplateField;
		value: unknown;
		error?: string;
		onValueChange: (value: string) => void;
		onCommit: () => void;
	} = $props();
</script>

<input
	id="field-{field.name}"
	type={field.type === 'number' ? 'number' : 'text'}
	value={String(value ?? '')}
	oninput={(event) => onValueChange((event.currentTarget as HTMLInputElement).value)}
	onblur={() => {
		if (field.type === 'number') onCommit();
	}}
	placeholder={field.placeholder || field.description}
	class={cn(
		'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
		error && 'border-red-500'
	)}
/>
