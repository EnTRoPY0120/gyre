<script lang="ts">
	import {
		ArrowDown,
		ArrowUp,
		ArrowUpDown
	} from '@lucide/svelte';

	let {
		sortBy,
		sortOrder,
		onSort
	}: {
		sortBy: 'date' | 'action';
		sortOrder: 'asc' | 'desc';
		onSort: (column: 'date' | 'action') => void;
	} = $props();
</script>

<thead>
	<tr class="border-b border-slate-700/50 bg-slate-900/30">
		<th class="px-4 py-3 font-medium text-slate-400">
			<button
				onclick={() => onSort('date')}
				class="flex items-center gap-1 transition-colors hover:text-white"
			>
				Time
				{#if sortBy === 'date' && sortOrder === 'asc'}
					<ArrowUp size={13} />
				{:else if sortBy === 'date' && sortOrder === 'desc'}
					<ArrowDown size={13} />
				{:else}
					<ArrowUpDown size={13} />
				{/if}
			</button>
		</th>
		<th class="px-4 py-3 font-medium text-slate-400">User</th>
		<th class="px-4 py-3 font-medium text-slate-400">
			<button
				onclick={() => onSort('action')}
				class="flex items-center gap-1 transition-colors hover:text-white"
			>
				Action
				{#if sortBy === 'action' && sortOrder === 'asc'}
					<ArrowUp size={13} />
				{:else if sortBy === 'action' && sortOrder === 'desc'}
					<ArrowDown size={13} />
				{:else}
					<ArrowUpDown size={13} />
				{/if}
			</button>
		</th>
		<th class="px-4 py-3 font-medium text-slate-400">Resource</th>
		<th class="hidden px-4 py-3 font-medium text-slate-400 lg:table-cell">Context</th>
		<th class="px-4 py-3 font-medium text-slate-400">Status</th>
		<th class="w-10 px-4 py-3"></th>
	</tr>
</thead>
