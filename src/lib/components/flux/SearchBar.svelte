<script lang="ts">
	import { Search, X } from 'lucide-svelte';

	interface Props {
		value: string;
		placeholder?: string;
		onSearch: (query: string) => void;
	}

	let { value = '', placeholder = 'Search resources...', onSearch }: Props = $props();

	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const newValue = target.value;

		// Debounce the search
		if (debounceTimer) clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			onSearch(newValue);
		}, 300);
	}

	function clearSearch() {
		if (debounceTimer) clearTimeout(debounceTimer);
		onSearch('');
	}
</script>

<div class="relative">
	<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
		<Search class="h-4 w-4 text-muted-foreground" />
	</div>
	<input
		type="text"
		class="block w-full rounded-lg border border-border bg-background py-2 pr-10 pl-10 text-sm text-foreground placeholder-muted-foreground transition-colors focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
		{placeholder}
		{value}
		oninput={handleInput}
	/>
	{#if value}
		<button
			type="button"
			class="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
			onclick={clearSearch}
			aria-label="Clear search"
		>
			<X class="h-4 w-4" />
		</button>
	{/if}
</div>
