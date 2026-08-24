<script lang="ts">
	import FieldHelp from '$lib/components/wizards/FieldHelp.svelte';
	import ArrayField from '$lib/components/wizards/ArrayField.svelte';
	import ReferenceField from '$lib/components/wizards/ReferenceField.svelte';
	import WizardFieldBoolean from './WizardFieldBoolean.svelte';
	import WizardFieldInput from './WizardFieldInput.svelte';
	import WizardFieldSelect from './WizardFieldSelect.svelte';
	import WizardFieldTextarea from './WizardFieldTextarea.svelte';
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

	function setValue(nextValue: unknown) {
		value = nextValue;
		onValueChange(nextValue);
	}

	function ensureArrayValue() {
		if (!Array.isArray(value)) {
			value = [];
		}
	}
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

	{#if field.type === 'select'}
		<WizardFieldSelect {field} {value} {error} onValueChange={setValue} />
	{:else if field.type === 'boolean'}
		<WizardFieldBoolean {field} {value} onValueChange={setValue} />
	{:else if field.type === 'textarea'}
		<WizardFieldTextarea {field} {value} {error} onValueChange={setValue} />
	{:else if field.type === 'array'}
		{@const _ = ensureArrayValue()}
		<ArrayField
			bind:value={value as unknown[]}
			itemType={field.arrayItemType || 'string'}
			itemFields={field.arrayItemFields || []}
			placeholder={field.placeholder}
			error={error}
		/>
	{:else if field.referenceType || field.referenceTypeField}
		<ReferenceField
			id="field-{field.name}"
			bind:value={value as string}
			referenceType={field.referenceType}
			referenceTypeField={field.referenceTypeField}
			referenceNamespace={field.referenceNamespaceField
				? String(formValues[field.referenceNamespaceField] ?? '')
				: ''}
			{formValues}
			placeholder={field.placeholder || field.description}
			error={error}
			onValueChange={onReferenceValueChange}
		/>
	{:else}
		<WizardFieldInput {field} {value} {error} onValueChange={setValue} {onCommit} />
	{/if}

	{#if error}
		<p class="text-xs text-red-500">{error}</p>
	{:else if field.description && field.type !== 'boolean'}
		<p class="text-xs text-muted-foreground">{field.description}</p>
	{/if}
</div>
