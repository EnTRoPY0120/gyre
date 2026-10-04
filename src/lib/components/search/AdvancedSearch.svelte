<script lang="ts">
	import { Search, SlidersHorizontal, X } from '@lucide/svelte';
	import { cn } from '$lib/utils';
	import type { FilterState } from '$lib/utils/filtering';
	import { MAX_QUERY_LENGTH, parseQuery, removeSearchTag, validateResourceSearchRegex, type SearchTagKey } from '$lib/utils/search';

	interface Props {
		filters: FilterState;
		placeholder?: string;
		onSearch?: (query: string) => void;
		validationSearch?: string;
	}

	let {
		filters = $bindable(),
		placeholder = 'Search resources...',
		onSearch,
		validationSearch
	}: Props = $props();

	let isAdvancedOpen = $state(false);
	let searchInput: HTMLInputElement;
	const parsed = $derived(parseQuery(validationSearch ?? filters.search));
	const chips = $derived(parseQuery(filters.search).effectiveTags);
	const regexError = $derived(
		filters.useRegex ? validateResourceSearchRegex(validationSearch ?? filters.search).error : null
	);

	function updateSearch(query: string) {
		filters.search = query.slice(0, MAX_QUERY_LENGTH);
		onSearch?.(filters.search);
	}

	function clearSearch() {
		updateSearch('');
		searchInput.focus();
	}

	function removeTag(key: SearchTagKey) {
		updateSearch(removeSearchTag(filters.search, key));
		searchInput.focus();
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		updateSearch(target.value);
		target.value = filters.search;
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
			id="resource-search"
			bind:this={searchInput}
			aria-label="Search resources"
			maxlength={MAX_QUERY_LENGTH}
			value={filters.search}
			oninput={handleInput}
			{placeholder}
			aria-invalid={regexError || parsed.errors.length ? 'true' : undefined}
			aria-describedby={[
				regexError ? 'resource-search-regex-error' : '',
				parsed.errors.length ? 'resource-search-tag-error' : '',
				isAdvancedOpen ? 'resource-search-help' : ''
			].filter(Boolean).join(' ') || undefined}
			class="h-11 w-full rounded-xl border border-border bg-card/50 pr-20 pl-10 text-sm ring-offset-background transition-all focus:border-primary/50 focus:bg-card focus:ring-2 focus:ring-primary/20 focus:outline-none"
		/>

		<div class="absolute right-2 flex items-center gap-1">
			{#if filters.search}
				<button
					type="button"
					onclick={clearSearch}
					class="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
					aria-label="Clear search"
				>
					<X size={14} />
				</button>
			{/if}

			<button
					type="button"
				onclick={() => (isAdvancedOpen = !isAdvancedOpen)}
				class={cn(
					'flex size-7 items-center justify-center rounded-lg border transition-all',
					isAdvancedOpen
						? 'border-primary/30 bg-primary/10 text-primary shadow-sm'
						: 'border-transparent text-muted-foreground hover:bg-muted'
				)}
				title="Advanced Search"
				aria-label="Advanced search options"
				aria-expanded={isAdvancedOpen}
				aria-controls="resource-search-options"
			>
				<SlidersHorizontal size={14} />
			</button>
		</div>
	</div>
	{#if chips.length}
		<div class="flex flex-wrap gap-2" aria-label="Query filters">
			{#each chips as tag (tag.key)}
				<button type="button" onclick={() => removeTag(tag.key)}
					class="inline-flex items-center gap-1 rounded-lg border border-border bg-muted px-2 py-1 text-xs hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary"
					aria-label={`Remove ${tag.key === 'ns' ? 'namespace' : 'status'} filter: ${tag.value || '(empty)'}`}>
					{tag.key === 'ns' ? 'namespace' : 'status'}:{tag.value}<X size={12} />
				</button>
			{/each}
		</div>
	{/if}
	{#if parsed.errors.length}
		<div id="resource-search-tag-error" class="text-xs text-destructive" role="status">
			{#each parsed.errors as tag (tag.key)}<p>{tag.error}</p>{/each}
		</div>
	{/if}
	{#if regexError}
		<p id="resource-search-regex-error" class="text-xs text-destructive" role="status">
			{regexError}
		</p>
	{/if}

	{#if isAdvancedOpen}
		<div
			id="resource-search-options"
			class="animate-in fade-in slide-in-from-top-2 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card/60 p-4 shadow-xl backdrop-blur-md duration-200"
		>
			<div class="flex items-center gap-2">
				<span class="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
					>Mode:</span
				>
				<div class="flex rounded-lg border border-border bg-muted/30 p-0.5" role="group" aria-label="Search mode">
					<button
					type="button"
						class={cn(
							'rounded-md px-2 py-1 text-[11px] font-bold transition-all',
							!filters.useRegex
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
						aria-pressed={!filters.useRegex}
						onclick={() => (filters.useRegex = false)}
					>
						Fuzzy
					</button>
					<button
					type="button"
						class={cn(
							'rounded-md px-2 py-1 text-[11px] font-bold transition-all',
							filters.useRegex
								? 'bg-primary text-primary-foreground'
								: 'text-muted-foreground hover:text-foreground'
						)}
						aria-pressed={filters.useRegex}
						onclick={() => (filters.useRegex = true)}
					>
						Regex
					</button>
				</div>
			</div>

			<div id="resource-search-help" class="w-full space-y-1 text-xs text-muted-foreground">
				<p>Fuzzy: <code>nginx ns:flux-system status:healthy</code>. Regex: <code>^nginx-(web|api) ns:default</code>.</p>
				<p><code>ns:</code> and <code>namespace:</code> are aliases. Tags must be separate words. Repeated tags use the last value.</p>
				<p>Status: healthy (or ready), progressing, failed, suspended, unknown. Query tags and dropdown filters both apply.</p>
				<p>Escape a tag with a backslash to search it as text. URLs and unknown prefixes stay searchable. Maximum {MAX_QUERY_LENGTH} characters.</p>
			</div>
		</div>
	{/if}
</div>
