<script lang="ts">
	import { Check, Loader2, Search } from '@lucide/svelte';
import { cn } from '$lib/utils';
import type { ReferenceOption } from './reference-fetch';

	let {
		loading,
		filteredResources,
		focusedIndex,
		isSelectedResource,
		searchQuery = $bindable(''),
		searchInput = $bindable(),
		onSelect
	}: {
		loading: boolean;
		filteredResources: ReferenceOption[];
		focusedIndex: number;
		isSelectedResource: (resource: ReferenceOption) => boolean;
		searchQuery: string;
		searchInput: HTMLInputElement | undefined;
		onSelect: (resource: ReferenceOption) => void;
	} = $props();
</script>

<div
	id="resource-listbox"
	class="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 shadow-xl"
	role="listbox"
>
	<div class="flex items-center border-b border-zinc-800 px-3">
		<Search class="mr-2 h-4 w-4 shrink-0 opacity-50" />
		<input
			bind:this={searchInput}
			class="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50"
			placeholder="Search resources..."
			bind:value={searchQuery}
		/>
	</div>
	<div class="max-h-[200px] overflow-y-auto p-1">
		{#if loading}
			<div class="flex items-center justify-center py-6 text-sm text-zinc-500">
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				Loading resources...
			</div>
		{:else if filteredResources.length === 0}
			<div class="py-6 text-center text-sm text-zinc-500">No resources found.</div>
		{:else}
			{#each filteredResources as resource, i (resource.key)}
				<button
					type="button"
					class={cn(
						'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-zinc-800 hover:text-zinc-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
						focusedIndex === i && 'bg-zinc-800 text-zinc-50'
					)}
					onclick={() => onSelect(resource)}
					role="option"
					aria-selected={isSelectedResource(resource)}
					tabindex="-1"
				>
					<Check
						class={cn(
							'mr-2 h-4 w-4',
							isSelectedResource(resource) ? 'opacity-100' : 'opacity-0'
						)}
					/>
					{resource.label}
				</button>
			{/each}
		{/if}
	</div>
</div>
