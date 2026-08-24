<script lang="ts">
	import ReferenceField from './ReferenceField.svelte';
	import type { ReferenceOption } from './reference-fetch';
	import type { TemplateField } from '$lib/templates';
	import * as Select from '$lib/components/ui/select';

	let {
		item,
		itemFields,
		disabled = false,
		onUpdateField,
		onReferenceValueChange
	}: {
		item: { id: string; val: unknown };
		itemFields: TemplateField[];
		disabled?: boolean;
		onUpdateField: (fieldName: string, value: unknown) => void;
		onReferenceValueChange: (
		field: TemplateField,
		nextValue: string,
		selection?: ReferenceOption
		) => void;
	} = $props();

	function isRecord(val: unknown): val is Record<string, unknown> {
		return typeof val === 'object' && val !== null && !Array.isArray(val);
	}
</script>

<div class="flex-1 rounded-lg border border-zinc-800 bg-zinc-950/30 p-4">
	<div class="grid gap-4 sm:grid-cols-2">
		{#each itemFields as field}
			<div class="flex flex-col gap-1.5">
				<label class="text-xs font-medium text-zinc-400" for="item-{item.id}-{field.name}">
					{field.label}
					{#if field.required}<span class="text-red-500">*</span>{/if}
				</label>
				{#if field.referenceType || field.referenceTypeField}
					<ReferenceField
						id="item-{item.id}-{field.name}"
						value={String(isRecord(item.val) ? (item.val[field.name] ?? '') : '')}
						onValueChange={(nextValue, selection) =>
							onReferenceValueChange(field, nextValue, selection)}
						referenceType={field.referenceType}
						referenceTypeField={field.referenceTypeField}
						referenceNamespace={field.referenceNamespaceField && isRecord(item.val)
							? String(item.val[field.referenceNamespaceField] ?? '')
							: ''}
						formValues={isRecord(item.val) ? item.val : {}}
						placeholder={field.placeholder}
						{disabled}
					/>
				{:else if field.type === 'select'}
					<Select.Root
						type="single"
						value={String(isRecord(item.val) ? (item.val[field.name] ?? '') : '')}
						onValueChange={(v) => onUpdateField(field.name, v)}
						{disabled}
					>
						<Select.Trigger
							id="item-{item.id}-{field.name}"
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						>
							<Select.Value placeholder="Select {field.label}">
								{#if isRecord(item.val)}
									{@const rec = item.val as Record<string, unknown>}
									{field.options?.find((o) => String(o.value) === String(rec[field.name]))?.label ??
										rec[field.name] ??
										`Select ${field.label}`}
								{:else}
									{`Select ${field.label}`}
								{/if}
							</Select.Value>
						</Select.Trigger>
						<Select.Content>
							{#each field.options || [] as opt}
								<Select.Item value={opt.value}>{opt.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				{:else}
					<input
						id="item-{item.id}-{field.name}"
						type="text"
						value={isRecord(item.val) ? (item.val[field.name] ?? '') : ''}
						oninput={(event) =>
							onUpdateField(field.name, (event.currentTarget as HTMLInputElement).value)}
						placeholder={field.placeholder}
						{disabled}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					/>
				{/if}
			</div>
		{/each}
	</div>
</div>
