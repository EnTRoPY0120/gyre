<script lang="ts">
	import { preferences } from '$lib/stores/preferences.svelte';

	const viewMode = $derived(preferences.viewMode);
</script>

<div class="inline-flex shrink-0 self-start rounded-lg border border-border bg-card p-1">
	<button
		type="button"
		class="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors {viewMode ===
		'table'
			? 'bg-primary text-primary-foreground'
			: 'text-muted-foreground hover:text-foreground'}"
		onclick={() => preferences.setViewMode('table')}
	>
		<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
			/>
		</svg>
		Table
	</button>

	<button
		type="button"
		class="inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors {viewMode ===
		'grid'
			? 'bg-muted text-foreground'
			: 'text-muted-foreground hover:text-foreground'}"
		onclick={() => preferences.setViewMode('grid')}
	>
		<svg class="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
			/>
		</svg>
		Grid
	</button>
</div>
