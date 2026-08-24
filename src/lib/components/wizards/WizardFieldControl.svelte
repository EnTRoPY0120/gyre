<script lang="ts">
	import type { ReferenceOption } from '$lib/components/wizards/reference-fetch';
	import ArrayField from '$lib/components/wizards/ArrayField.svelte';
	import ReferenceField from '$lib/components/wizards/ReferenceField.svelte';
	import WizardFieldBoolean from './WizardFieldBoolean.svelte';
	import WizardFieldInput from './WizardFieldInput.svelte';
	import WizardFieldSelect from './WizardFieldSelect.svelte';
	import WizardFieldTextarea from './WizardFieldTextarea.svelte';
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
		if (!Array.isArray(value)) value = [];
	}
</script>

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
