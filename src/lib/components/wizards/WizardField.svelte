<script lang="ts">
	import FieldHelp from '$lib/components/wizards/FieldHelp.svelte';
	import WizardFieldControl from './WizardFieldControl.svelte';
	import type { ReferenceOption } from '$lib/components/wizards/reference-fetch';
	import type { TemplateField } from '$lib/templates';

	let {
		field,
		value = $bindable(),
		formValues,
		error,
		onValueChange,
		onReferenceValueChange,
		onCommit
	}: {
		field: TemplateField;
		value: unknown;
		formValues: Record<string, unknown>;
		error?: string;
		onValueChange: (value: unknown) => void;
		onReferenceValueChange: (value: string, selection?: ReferenceOption) => void;
		onCommit: () => void;
	} = $props();

</script>

<div class="flex flex-col gap-1.5">
	<div class="flex items-center gap-2">
		<label
			for="field-{field.name}"
			class="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
		>
			{field.label}
			{#if field.required}<span class="text-red-500">*</span>{/if}
		</label>
		<FieldHelp helpText={field.helpText} docsUrl={field.docsUrl} />
	</div>

	<WizardFieldControl
		{field}
		bind:value
		{formValues}
		{error}
		{onValueChange}
		{onReferenceValueChange}
		{onCommit}
	/>

	{#if error}
		<p class="text-xs text-red-500">{error}</p>
	{:else if field.description && field.type !== 'boolean'}
		<p class="text-xs text-muted-foreground">{field.description}</p>
	{/if}
</div>
