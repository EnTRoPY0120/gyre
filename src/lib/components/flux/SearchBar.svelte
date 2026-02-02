<script lang="ts">
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
		<svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
	</div>
	<input
		type="text"
		class="block w-full rounded-lg border border-gray-200 bg-white py-2 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
		{placeholder}
		{value}
		oninput={handleInput}
	/>
	{#if value}
		<button
			type="button"
			class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
			onclick={clearSearch}
			aria-label="Clear search"
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	{/if}
</div>
