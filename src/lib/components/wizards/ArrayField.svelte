<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus, Trash2 } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import ReferenceField from './ReferenceField.svelte';
	import type { TemplateField } from '$lib/templates';

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

	function addItem() {
		if (itemType === 'string') {
			value = [...value, ''];
		} else {
			const newItem: Record<string, unknown> = {};
			itemFields.forEach((field) => {
				if (field.default !== undefined) {
					newItem[field.name] = field.default;
				}
			});
			value = [...value, newItem];
		}
	}

	function removeItem(index: number) {
		value = value.filter((_, i) => i !== index);
	}

	function updateItem(index: number, newValue: unknown) {
		const updated = [...value];
		updated[index] = newValue;
		value = updated;
	}

	function updateObjectItem(index: number, fieldName: string, newValue: unknown) {
		const updated = [...value];
		const item = { ...(updated[index] as Record<string, unknown>) };
		item[fieldName] = newValue;
		updated[index] = item;
		value = updated;
	}
</script>

<div class="flex flex-col gap-4">
	{#each value as item, index (index)}
		<div class="flex items-start gap-2">
			{#if itemType === 'string'}
				<input
					type="text"
					value={item as string}
					oninput={(e) => updateItem(index, (e.target as HTMLInputElement).value)}
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
								<label class="text-xs font-medium text-zinc-400" for="item-{index}-{field.name}">
									{field.label}
									{#if field.required}<span class="text-red-500">*</span>{/if}
								</label>
								{#if field.referenceType || field.referenceTypeField}
									<ReferenceField
										value={String((item as any)[field.name] || '')}
										onValueChange={(v) => updateObjectItem(index, field.name, v)}
										referenceType={field.referenceType}
										referenceTypeField={field.referenceTypeField}
										formValues={item as any}
										placeholder={field.placeholder}
										{disabled}
									/>
								{:else if field.type === 'select'}
									<select
										id="item-{index}-{field.name}"
										value={(item as any)[field.name] || ''}
										onchange={(e) =>
											updateObjectItem(index, field.name, (e.target as HTMLSelectElement).value)}
										class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									>
										{#each field.options || [] as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								{:else}
									<input
										id="item-{index}-{field.name}"
										type="text"
										value={(item as any)[field.name] || ''}
										oninput={(e) =>
											updateObjectItem(index, field.name, (e.target as HTMLInputElement).value)}
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
				onclick={() => removeItem(index)}
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
