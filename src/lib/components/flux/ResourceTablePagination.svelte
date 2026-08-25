<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { ITEMS_PER_PAGE_OPTIONS, preferences } from '$lib/stores/preferences.svelte';

	let {
		resourceCount,
		showAll,
		itemsPerPage,
		currentPage,
		totalPages,
		onPageChange,
		onItemsPerPageChange
	}: {
		resourceCount: number;
		showAll: boolean;
		itemsPerPage: number;
		currentPage: number;
		totalPages: number;
		onPageChange: (page: number) => void;
		onItemsPerPageChange: (size: number) => void;
	} = $props();
</script>

{#if resourceCount > Math.min(...ITEMS_PER_PAGE_OPTIONS.filter((size) => size > 0))}
	<div class="flex items-center justify-between px-2">
		<div class="flex items-center gap-3">
			{#if showAll}
				<div class="text-xs text-muted-foreground">
					Showing all <span class="font-medium">{resourceCount}</span> results
				</div>
			{:else}
				<div class="text-xs text-muted-foreground">
					Showing <span class="font-medium"
						>{Math.min((currentPage - 1) * itemsPerPage + 1, resourceCount)}</span
					>
					to
					<span class="font-medium">{Math.min(currentPage * itemsPerPage, resourceCount)}</span>
					of <span class="font-medium">{resourceCount}</span> results
				</div>
			{/if}
			<div class="flex items-center gap-1.5">
				<span class="text-xs text-muted-foreground">Per page:</span>
				{#each ITEMS_PER_PAGE_OPTIONS as size (size)}
					<button
						class="rounded px-2 py-0.5 text-xs transition-colors {itemsPerPage === size
							? 'bg-primary text-primary-foreground'
							: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
						onclick={() => {
							preferences.setItemsPerPage(size);
							onItemsPerPageChange(size);
						}}
						aria-pressed={itemsPerPage === size}
					>
						{size === 0 ? 'All' : size}
					</button>
				{/each}
			</div>
		</div>
		{#if !showAll && totalPages > 1}
			<div class="flex items-center gap-2">
				<button
					class="flex size-8 items-center justify-center rounded-md border border-border bg-card/60 text-muted-foreground transition-all hover:bg-accent disabled:opacity-30"
					onclick={() => onPageChange(Math.max(1, currentPage - 1))}
					disabled={currentPage === 1}
					aria-label="Previous page"
				>
					<ChevronLeft size={16} />
				</button>
				<div class="text-xs font-medium">
					Page {currentPage} of {totalPages}
				</div>
				<button
					class="flex size-8 items-center justify-center rounded-md border border-border bg-card/60 text-muted-foreground transition-all hover:bg-accent disabled:opacity-30"
					onclick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
					disabled={currentPage === totalPages}
					aria-label="Next page"
				>
					<ChevronRight size={16} />
				</button>
			</div>
		{/if}
	</div>
{/if}
