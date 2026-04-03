<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus, Trash2 } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import ReferenceField from './ReferenceField.svelte';
	import type { TemplateField } from '$lib/templates';
	import * as Select from '$lib/components/ui/select';

	let {
		value = $bindable([]),
		itemType = 'string',
		itemFields = [],
		placeholder = '',
		disabled = false,
		error = ''
	}: {
		value: unknown[];
		itemType: 'string' | 'object';
		itemFields?: TemplateField[];
		placeholder?: string;
		disabled?: boolean;
		error?: string;
	} = $props();

	// Internal state with stable IDs for the each loop
	let items = $state<{ id: string; val: unknown }[]>([]);

	// Synchronize items with external value changes
	$effect(() => {
		const newItems = value.map((v, i) => {
			const existingItem = items[i];
			// If value at this index is the same as internal val, keep the ID
			if (existingItem && JSON.stringify(existingItem.val) === JSON.stringify(v)) {
				return existingItem;
			}
			// Otherwise create a new entry (preferring existing ID if structure matches)
			return { id: existingItem?.id || Math.random().toString(36).substring(2, 11), val: v };
		});

		if (JSON.stringify(newItems.map((i) => i.val)) !== JSON.stringify(items.map((i) => i.val))) {
			items = newItems;
		}
	});

	// Synchronize value when items change
	$effect(() => {
		const newValues = items.map((i) => i.val);
		if (JSON.stringify(newValues) !== JSON.stringify(value)) {
			value = newValues;
		}
	});

	function addItem() {
		const id = Math.random().toString(36).substring(2, 11);
		if (itemType === 'string') {
			items = [...items, { id, val: '' }];
		} else {
			const newItem: Record<string, unknown> = {};
			itemFields.forEach((field) => {
				if (field.default !== undefined) {
					newItem[field.name] = field.default;
				}
			});
			items = [...items, { id, val: newItem }];
		}
	}

	function removeItem(id: string) {
		items = items.filter((i) => i.id !== id);
	}

	function updateItem(id: string, newValue: unknown) {
		items = items.map((i) => (i.id === id ? { ...i, val: newValue } : i));
	}

	function isRecord(val: unknown): val is Record<string, unknown> {
		return typeof val === 'object' && val !== null && !Array.isArray(val);
	}

	function updateObjectItem(id: string, fieldName: string, newValue: unknown) {
		items = items.map((i) => {
			if (i.id === id) {
				const item = { ...(isRecord(i.val) ? i.val : {}) };
				item[fieldName] = newValue;
				return { ...i, val: item };
			}
			return i;
		});
	}

	function handleReferenceValueChange(
		id: string,
		field: TemplateField,
		nextValue: string,
		selection?: { namespace?: string }
	) {
		updateObjectItem(id, field.name, nextValue);
		if (field.referenceNamespaceField) {
			updateObjectItem(id, field.referenceNamespaceField, selection?.namespace ?? '');
		}
	}
</script>

<div class="flex flex-col gap-4">
	{#each items as item (item.id)}
		<div class="flex items-start gap-2">
			{#if itemType === 'string'}
				<input
					type="text"
					value={item.val as string}
					oninput={(e) => updateItem(item.id, (e.target as HTMLInputElement).value)}
					{placeholder}
					{disabled}
					class={cn(
						'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
						error && 'border-red-500'
					)}
				/>
			{:else}
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
											handleReferenceValueChange(item.id, field, nextValue, selection)}
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
										onValueChange={(v) => updateObjectItem(item.id, field.name, v)}
										{disabled}
									>
										<Select.Trigger
											id="item-{item.id}-{field.name}"
											class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
										>
											<Select.Value placeholder="Select {field.label}">
												{#if isRecord(item.val)}
													{@const rec = item.val as Record<string, unknown>}
													{field.options?.find(
														(o) => String(o.value) === String(rec[field.name])
													)?.label ??
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
										oninput={(e) =>
											updateObjectItem(item.id, field.name, (e.target as HTMLInputElement).value)}
										placeholder={field.placeholder}
										{disabled}
										class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									/>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<Button
				variant="ghost"
				size="icon"
				onclick={() => removeItem(item.id)}
				{disabled}
				class="mt-1 shrink-0 text-muted-foreground hover:text-red-500"
			>
				<Trash2 size={16} />
			</Button>
		</div>
	{/each}

	<Button variant="outline" size="sm" onclick={addItem} {disabled} class="w-fit">
		<Plus size={16} class="mr-2" />
		Add {itemType === 'string' ? 'Item' : 'Entry'}
	</Button>

	{#if error}
		<p class="text-xs text-red-500">{error}</p>
	{/if}
</div>
