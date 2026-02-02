<script lang="ts">
	import type { FilterState } from '$lib/utils/filtering';
	import type { ResourceHealth } from '$lib/utils/flux';

	interface Props {
		filters: FilterState;
		namespaces: string[];
		onFilterChange: (filters: FilterState) => void;
		onClearFilters: () => void;
		hasActiveFilters: boolean;
	}

	let { filters, namespaces, onFilterChange, onClearFilters, hasActiveFilters }: Props = $props();

	const statusOptions: { value: ResourceHealth | 'all'; label: string; color: string }[] = [
		{ value: 'all', label: 'All Status', color: 'bg-gray-100 text-gray-700' },
		{ value: 'healthy', label: 'Healthy', color: 'bg-green-100 text-green-700' },
		{ value: 'progressing', label: 'Progressing', color: 'bg-blue-100 text-blue-700' },
		{ value: 'failed', label: 'Failed', color: 'bg-red-100 text-red-700' },
		{ value: 'suspended', label: 'Suspended', color: 'bg-gray-200 text-gray-600' },
		{ value: 'unknown', label: 'Unknown', color: 'bg-yellow-100 text-yellow-700' }
	];

	function handleNamespaceChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		onFilterChange({ ...filters, namespace: target.value });
	}

	function handleStatusChange(e: Event) {
		const target = e.target as HTMLSelectElement;
		onFilterChange({ ...filters, status: target.value as ResourceHealth | 'all' });
	}

	function handleLabelsChange(e: Event) {
		const target = e.target as HTMLInputElement;
		onFilterChange({ ...filters, labels: target.value });
	}
</script>

<div class="flex flex-wrap items-center gap-3">
	<!-- Namespace Filter -->
	<div class="flex items-center gap-2">
		<label for="namespace-filter" class="text-sm font-medium text-gray-500 dark:text-gray-400">Namespace:</label>
		<select
			id="namespace-filter"
			class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
			value={filters.namespace}
			onchange={handleNamespaceChange}
		>
			<option value="">All Namespaces</option>
			{#each namespaces as ns}
				<option value={ns}>{ns}</option>
			{/each}
		</select>
	</div>

	<!-- Status Filter -->
	<div class="flex items-center gap-2">
		<label for="status-filter" class="text-sm font-medium text-gray-500 dark:text-gray-400">Status:</label>
		<select
			id="status-filter"
			class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
			value={filters.status}
			onchange={handleStatusChange}
		>
			{#each statusOptions as option}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</div>

	<!-- Labels Filter -->
	<div class="flex items-center gap-2">
		<label for="labels-filter" class="text-sm font-medium text-gray-500 dark:text-gray-400">Labels:</label>
		<input
			id="labels-filter"
			type="text"
			class="w-48 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:placeholder-gray-500"
			placeholder="key=value,..."
			value={filters.labels}
			oninput={handleLabelsChange}
		/>
	</div>

	<!-- Clear Filters Button -->
	{#if hasActiveFilters}
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
			onclick={onClearFilters}
		>
			<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
			Clear Filters
		</button>
	{/if}
</div>
