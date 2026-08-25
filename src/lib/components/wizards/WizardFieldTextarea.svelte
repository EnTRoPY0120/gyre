<script lang="ts">
	import { cn } from '$lib/utils';
	import type { TemplateField } from '$lib/templates';

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

<textarea
	id="field-{field.name}"
	value={String(value ?? '')}
	oninput={(event) => onValueChange((event.currentTarget as HTMLTextAreaElement).value)}
	placeholder={field.placeholder || field.description}
	rows="4"
	class={cn(
		'flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
		error && 'border-red-500'
	)}
></textarea>
