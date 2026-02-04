<script lang="ts">
	import { Search, SlidersHorizontal, X } from 'lucide-svelte';
	import { cn } from '$lib/utils';
	import type { FilterState } from '$lib/utils/filtering';

	interface Props {
		filters: FilterState;
		placeholder?: string;
		onSearch?: (query: string) => void;
	}

	let { filters = $bindable(), placeholder = 'Search resources...', onSearch }: Props = $props();

	let isAdvancedOpen = $state(false);

	function clearSearch() {
		filters.search = '';
		if (onSearch) onSearch('');
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		filters.search = target.value;
		if (onSearch) onSearch(target.value);
	}
</script>

<div class="relative flex flex-col gap-2">
	<div class="group relative flex items-center">
		<div
			class="pointer-events-none absolute left-3 text-muted-foreground transition-colors group-focus-within:text-primary"
		>
			<Search size={18} />
		</div>

		<input
			type="text"
			value={filters.search}
			oninput={handleInput}
			{placeholder}
			class="h-11 w-full rounded-xl border border-border bg-card/50 pr-20 pl-10 text-sm ring-offset-background transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
		/>

		<div class="absolute right-2 flex items-center gap-1">
			{#if filters.search}
				<button
					onclick={clearSearch}
					class="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
					aria-label="Clear search"
				>
					<X size={14} />
				</button>
			{/if}

			<button
				onclick={() => (isAdvancedOpen = !isAdvancedOpen)}
				class={cn(
					'flex size-7 items-center justify-center rounded-lg border transition-all',
					isAdvancedOpen
						? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
						: 'border-transparent text-muted-foreground hover:bg-muted'
				)}
				title="Advanced Search"
			>
				<SlidersHorizontal size={14} />
			</button>
		</div>
	</div>

	{#if isAdvancedOpen}
		<div
			class="animate-in fade-in slide-in-from-top-2 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/60 p-4 shadow-xl backdrop-blur-md duration-200"
		>
			<div class="flex items-center gap-2">
				<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
					>Mode:</span
				>
				<div class="flex rounded-lg border border-border bg-muted/30 p-0.5">
					<button
						class={cn(
							'rounded-md px-2 py-1 text-[11px] font-bold transition-all',
							!filters.useRegex
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
						onclick={() => (filters.useRegex = false)}
					>
						Fuzzy
					</button>
					<button
						class={cn(
							'rounded-md px-2 py-1 text-[11px] font-bold transition-all',
							filters.useRegex
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
						onclick={() => (filters.useRegex = true)}
					>
						Regex
					</button>
				</div>
			</div>

			<div class="h-4 w-px bg-border"></div>

			<div class="ml-auto flex items-center gap-3">
				<div class="flex items-center gap-1 text-[10px] text-muted-foreground">
					<span class="mr-1">Tips:</span>
					<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono">ns:default</kbd
					>
					<kbd class="rounded border border-border bg-muted px-1.5 py-0.5 font-mono"
						>status:ready</kbd
					>
				</div>
			</div>
		</div>
	{/if}
</div>
