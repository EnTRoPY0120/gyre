<script lang="ts">
	import { ChevronDown } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import WizardField from '$lib/components/wizards/WizardField.svelte';
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
				<div class="p-6">
					<button
						onclick={() => onToggleSection(section.id)}
						class="mb-4 flex w-full items-center justify-between text-left"
					>
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
									expandedSections[section.id] ? 'rotate-180' : ''
								)}
							/>
						{/if}
					</button>

					{#if expandedSections[section.id]}
						<div class="grid gap-6">
							{#each sectionFields as field (field.name)}
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
