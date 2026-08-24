<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import WizardField from '$lib/components/wizards/WizardField.svelte';
	import type { ReferenceOption } from './reference-fetch';
	import type { TemplateField, TemplateSection } from '$lib/templates';

	let {
		section,
		fields,
		expanded,
		formValues,
		validationErrors,
		shouldShowField,
		onToggle,
		onSetFieldValue,
		onReferenceValueChange,
		onCommit
	}: {
		section: TemplateSection;
		fields: TemplateField[];
		expanded: boolean;
		formValues: Record<string, unknown>;
		validationErrors: Record<string, string>;
		shouldShowField: (field: TemplateField) => boolean;
		onToggle: () => void;
		onSetFieldValue: (field: TemplateField, value: unknown) => void;
		onReferenceValueChange: (
		field: TemplateField,
		value: string,
		selection?: ReferenceOption
		) => void;
		onCommit: (field: TemplateField) => void;
	} = $props();
</script>

<div class="p-6">
	<button onclick={onToggle} class="mb-4 flex w-full items-center justify-between text-left">
		<div>
			<h3 class="text-base font-semibold">{section.title}</h3>
			{#if section.description}
				<p class="text-sm text-muted-foreground">{section.description}</p>
			{/if}
		</div>
		{#if section.collapsible}
			<ChevronDown
				size={20}
				class={cn(
					'text-muted-foreground transition-transform',
					expanded ? 'rotate-180' : ''
				)}
			/>
		{/if}
	</button>

	{#if expanded}
		<div class="grid gap-6">
			{#each fields as field (field.name)}
				{#if shouldShowField(field)}
					<WizardField
						field={field}
						bind:value={formValues[field.name]}
						{formValues}
						error={validationErrors[field.name]}
						onValueChange={(value) => onSetFieldValue(field, value)}
						onReferenceValueChange={(value, selection) =>
							onReferenceValueChange(field, value, selection)}
						onCommit={() => onCommit(field)}
					/>
				{/if}
			{/each}
		</div>
	{/if}
</div>
