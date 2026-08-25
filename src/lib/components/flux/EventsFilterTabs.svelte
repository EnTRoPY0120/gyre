<script lang="ts">
	import type { EventFilter } from './events-list-types';

	let {
		activeFilter,
		totalCount,
		warningCount,
		normalCount,
		onFilterChange
	}: {
		activeFilter: EventFilter;
		totalCount: number;
		warningCount: number;
		normalCount: number;
		onFilterChange: (filter: EventFilter) => void;
	} = $props();
</script>

<div class="flex items-center gap-2">
	<button
		type="button"
		class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {activeFilter === 'all'
			? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
			: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'}"
		onclick={() => onFilterChange('all')}
	>
		All ({totalCount})
	</button>
	<button
		type="button"
		class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {activeFilter === 'Warning'
			? 'bg-red-600 text-white'
			: 'bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50'}"
		onclick={() => onFilterChange('Warning')}
	>
		Warnings ({warningCount})
	</button>
	<button
		type="button"
		class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {activeFilter === 'Normal'
			? 'bg-green-600 text-white'
			: 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'}"
		onclick={() => onFilterChange('Normal')}
	>
		Normal ({normalCount})
	</button>
</div>
