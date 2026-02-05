<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Plus, Trash2 } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	let {
		value = $bindable([]),
		itemType = 'string',
		placeholder = '',
		disabled = false,
		error = ''
	}: {
		value: unknown[];
		itemType: 'string' | 'object';
		placeholder?: string;
		disabled?: boolean;
		error?: string;
	} = $props();

	function addItem() {
		if (itemType === 'string') {
			value = [...value, ''];
		} else {
			value = [...value, {}];
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
</script>

<div class="flex flex-col gap-2">
	{#each value as item, index (index)}
		<div class="flex items-center gap-2">
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
				<div class="flex-1 text-sm text-muted-foreground">Object item {index + 1}</div>
			{/if}

			<Button
				variant="ghost"
				size="icon"
				onclick={() => removeItem(index)}
				{disabled}
				class="shrink-0"
			>
				<Trash2 size={16} />
			</Button>
		</div>
	{/each}

	<Button variant="outline" size="sm" onclick={addItem} {disabled} class="w-fit">
		<Plus size={16} class="mr-2" />
		Add Item
	</Button>

	{#if error}
		<p class="text-xs text-red-500">{error}</p>
	{/if}
</div>
