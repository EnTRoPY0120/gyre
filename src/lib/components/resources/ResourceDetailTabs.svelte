<script lang="ts">
	import type { TabConfig, TabId } from '$lib/config/tabs';

	let {
		tabs,
		activeTab,
		onSelectTab,
		onKeydown
	}: {
		tabs: TabConfig[];
		activeTab: TabId;
		onSelectTab: (tab: TabId) => void;
		onKeydown: (event: KeyboardEvent, index: number) => void;
	} = $props();
</script>

<div class="scrollbar-none overflow-x-auto border-b border-gray-200 dark:border-gray-700">
	<div class="-mb-px flex min-w-max space-x-8" role="tablist" aria-label="Resource Details">
		{#each tabs as tab, i (tab.id)}
			<button
				id="{tab.id}-tab"
				role="tab"
				aria-selected={activeTab === tab.id}
				aria-controls="{tab.id}-panel"
				tabindex={activeTab === tab.id ? 0 : -1}
				type="button"
				class="border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap transition-colors {activeTab === tab.id
					? 'border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400'
					: 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300'}"
				onclick={() => onSelectTab(tab.id)}
				onkeydown={(event) => onKeydown(event, i)}
			>
				{tab.label}
			</button>
		{/each}
	</div>
</div>
