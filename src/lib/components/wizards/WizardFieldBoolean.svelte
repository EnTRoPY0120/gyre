<script lang="ts">
	import type { TemplateField } from '$lib/templates';

	let {
		field,
		value,
		onValueChange
	}: {
		field: TemplateField;
		value: unknown;
		onValueChange: (value: boolean) => void;
	} = $props();
</script>

<div class="flex items-center gap-2">
	<input
		id="field-{field.name}"
		type="checkbox"
		checked={Boolean(value)}
		onchange={(event) => onValueChange((event.currentTarget as HTMLInputElement).checked)}
		class="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
	/>
	<span class="text-sm text-muted-foreground">{field.description || ''}</span>
</div>
