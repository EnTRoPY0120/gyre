<script lang="ts">
	import { Search, X } from 'lucide-svelte';

	interface Props {
		value: string;
		placeholder?: string;
		onSearch?: (value: string) => void;
		class?: string;
	}

	let { value = $bindable(''), placeholder = 'Search...', onSearch, class: className = '' }: Props = $props();

	let inputValue = $state(value);

	// Sync inputValue with external value changes
	$effect(() => {
		inputValue = value;
	});

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		inputValue = target.value;
		if (onSearch) {
			onSearch(inputValue);
		}
	}

	function clearSearch() {
		inputValue = '';
		if (onSearch) {
			onSearch('');
		}
	}
</script>

<div class="relative {className}">
	<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
		<Search size={16} class="text-slate-400" />
	</div>
	<input
		type="text"
		value={inputValue}
		oninput={handleInput}
		placeholder={placeholder}
		class="w-full rounded-lg border border-slate-600 bg-slate-700 py-2 pl-10 pr-10 text-sm text-white placeholder-slate-400 focus:border-amber-500 focus:outline-none"
	/>
	{#if inputValue}
		<button
			type="button"
			onclick={clearSearch}
			class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
			aria-label="Clear search"
		>
			<X size={16} />
		</button>
	{/if}
</div>
