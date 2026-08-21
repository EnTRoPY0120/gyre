<script lang="ts">
	import YamlEditor from '$lib/components/editors/YamlEditor.svelte';
	import WizardFieldSections from '$lib/components/wizards/WizardFieldSections.svelte';
	import type { ReferenceOption } from '$lib/components/wizards/reference-fetch';
	import type { ResourceTemplate, TemplateField } from '$lib/templates';
	import { cn } from '$lib/utils';

	let {
		mode,
		template,
		fieldsBySection,
		expandedSections,
		formValues,
		validationErrors,
		shouldShowField,
		currentYaml = $bindable(''),
		copySuccess,
		yamlError,
		onCopy,
		onToggleSection,
		onSetFieldValue,
		onReferenceValueChange,
		onCommit
	}: {
		mode: 'wizard' | 'yaml';
		template: ResourceTemplate;
		fieldsBySection: Record<string, TemplateField[]>;
		expandedSections: Record<string, boolean>;
		formValues: Record<string, unknown>;
		validationErrors: Record<string, string>;
		shouldShowField: (field: TemplateField) => boolean;
		currentYaml: string;
		copySuccess: boolean;
		yamlError: string | null;
		onCopy: () => void;
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

<div
	class={cn(
		'rounded-xl border border-border bg-card/60 backdrop-blur-sm',
		mode === 'yaml' && 'min-h-[500px]'
	)}
>
	{#if mode === 'wizard'}
		<WizardFieldSections
			{template}
			{fieldsBySection}
			{expandedSections}
			{formValues}
			{validationErrors}
			{shouldShowField}
			onToggleSection={onToggleSection}
			onSetFieldValue={onSetFieldValue}
			onReferenceValueChange={onReferenceValueChange}
			onCommit={onCommit}
		/>
	{:else}
		<YamlEditor
			bind:value={currentYaml}
			onCopy={onCopy}
			{copySuccess}
			error={yamlError}
			className="h-full min-h-[500px]"
		/>
	{/if}
</div>
