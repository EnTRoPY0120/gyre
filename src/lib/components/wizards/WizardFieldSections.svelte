<script lang="ts">
	import WizardField from '$lib/components/wizards/WizardField.svelte';
	import WizardSection from './WizardSection.svelte';
	import type { ReferenceOption } from '$lib/components/wizards/reference-fetch';
	import type { ResourceTemplate, TemplateField } from '$lib/templates';

	let {
		template,
		fieldsBySection,
		expandedSections,
		formValues,
		validationErrors,
		shouldShowField,
		onToggleSection,
		onSetFieldValue,
		onReferenceValueChange,
		onCommit
	}: {
		template: ResourceTemplate;
		fieldsBySection: Record<string, TemplateField[]>;
		expandedSections: Record<string, boolean>;
		formValues: Record<string, unknown>;
		validationErrors: Record<string, string>;
		shouldShowField: (field: TemplateField) => boolean;
		onToggleSection: (sectionId: string) => void;
		onSetFieldValue: (field: TemplateField, value: unknown) => void;
		onReferenceValueChange: (
			field: TemplateField,
			value: string,
			selection?: ReferenceOption
		) => void;
		onCommit: (field: TemplateField) => void;
	} = $props();
</script>

<div class="divide-y divide-border">
	{#if template.sections}
		{#each template.sections as section (section.id)}
			{@const sectionFields = fieldsBySection[section.id] || []}
			{#if sectionFields.length > 0}
				<WizardSection
					{section}
					fields={sectionFields}
					expanded={expandedSections[section.id]}
					{formValues}
					{validationErrors}
					{shouldShowField}
					onToggle={() => onToggleSection(section.id)}
					{onSetFieldValue}
					{onReferenceValueChange}
					{onCommit}
				/>
			{/if}
		{/each}
	{:else}
		<div class="p-6">
			<div class="grid gap-6">
				{#each template.fields as field (field.name)}
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
		</div>
	{/if}
</div>
