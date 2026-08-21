<script lang="ts">
	import { cn } from '$lib/utils';
	import FieldHelp from '$lib/components/wizards/FieldHelp.svelte';
	import ArrayField from '$lib/components/wizards/ArrayField.svelte';
	import ReferenceField from '$lib/components/wizards/ReferenceField.svelte';
	import type { ReferenceOption } from '$lib/components/wizards/reference-fetch';
	import type { TemplateField } from '$lib/templates';
	import * as Select from '$lib/components/ui/select';

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
		<Select.Root
			type="single"
			value={String(value ?? '')}
			onValueChange={(nextValue) => setValue(nextValue)}
		>
			<Select.Trigger
				id="field-{field.name}"
				class={cn('w-full', error && 'border-red-500')}
			>
				<Select.Value placeholder="Select {field.label}">
					{field.options?.find((option) => String(option.value) === String(value))?.label ||
						value ||
						`Select ${field.label}`}
				</Select.Value>
			</Select.Trigger>
			<Select.Content>
				{#each field.options || [] as option (option.value)}
					<Select.Item value={option.value}>{option.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
	{:else if field.type === 'boolean'}
		<div class="flex items-center gap-2">
			<input
				id="field-{field.name}"
				type="checkbox"
				checked={Boolean(value)}
				onchange={(event) => setValue((event.currentTarget as HTMLInputElement).checked)}
				class="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
			/>
			<span class="text-sm text-muted-foreground">{field.description || ''}</span>
		</div>
	{:else if field.type === 'textarea'}
		<textarea
			id="field-{field.name}"
			value={String(value ?? '')}
			oninput={(event) => setValue((event.currentTarget as HTMLTextAreaElement).value)}
			placeholder={field.placeholder || field.description}
			rows="4"
			class={cn(
				'flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
				error && 'border-red-500'
			)}
		></textarea>
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
		<input
			id="field-{field.name}"
			type={field.type === 'number' ? 'number' : 'text'}
			value={String(value ?? '')}
			oninput={(event) => setValue((event.currentTarget as HTMLInputElement).value)}
			onblur={() => {
				if (field.type === 'number') onCommit();
			}}
			placeholder={field.placeholder || field.description}
			class={cn(
				'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
				error && 'border-red-500'
			)}
		/>
	{/if}

	{#if error}
		<p class="text-xs text-red-500">{error}</p>
	{:else if field.description && field.type !== 'boolean'}
		<p class="text-xs text-muted-foreground">{field.description}</p>
	{/if}
</div>
