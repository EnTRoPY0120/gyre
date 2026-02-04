<script lang="ts">
	import type { FilterState } from '$lib/utils/filtering';
	import type { ResourceHealth } from '$lib/utils/flux';
	import { X } from 'lucide-svelte';

	interface Props {
		filters: FilterState;
		namespaces: string[];
		onFilterChange: (filters: FilterState) => void;
		onClearFilters: () => void;
		hasActiveFilters: boolean;
	}

	let { filters, namespaces, onFilterChange, onClearFilters, hasActiveFilters }: Props = $props();

	const statusOptions: { value: ResourceHealth | 'all'; label: string; color: string }[] = [
		{ value: 'all', label: 'All Status', color: 'bg-muted text-muted-foreground' },
		{ value: 'healthy', label: 'Healthy', color: 'bg-green-500/10 text-green-500' },
		{ value: 'progressing', label: 'Progressing', color: 'bg-blue-500/10 text-blue-500' },
		{ value: 'failed', label: 'Failed', color: 'bg-destructive/10 text-destructive' },
		{ value: 'suspended', label: 'Suspended', color: 'bg-muted text-muted-foreground' },
		{ value: 'unknown', label: 'Unknown', color: 'bg-yellow-500/10 text-yellow-500' }
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
		<label for="namespace-filter" class="text-sm font-medium text-muted-foreground"
			>Namespace:</label
		>
		<select
			id="namespace-filter"
			class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
			value={filters.namespace}
			onchange={handleNamespaceChange}
		>
			<option value="">All Namespaces</option>
			{#each namespaces as ns (ns)}
				<option value={ns}>{ns}</option>
			{/each}
		</select>
	</div>

	<!-- Status Filter -->
	<div class="flex items-center gap-2">
		<label for="status-filter" class="text-sm font-medium text-muted-foreground">Status:</label>
		<select
			id="status-filter"
			class="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
			value={filters.status}
			onchange={handleStatusChange}
		>
			{#each statusOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	</div>

	<!-- Labels Filter -->
	<div class="flex items-center gap-2">
		<label for="labels-filter" class="text-sm font-medium text-muted-foreground">Labels:</label>
		<input
			id="labels-filter"
			type="text"
			class="w-48 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
			placeholder="key=value,..."
			value={filters.labels}
			oninput={handleLabelsChange}
		/>
	</div>

	<!-- Clear Filters Button -->
	{#if hasActiveFilters}
		<button
			type="button"
			class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
			onclick={onClearFilters}
		>
			<X class="h-4 w-4" />
			Clear Filters
		</button>
	{/if}
</div>
