<script lang="ts">
	import { Settings } from '@lucide/svelte';

	let {
		hasNotifications,
		showAllClusters,
		onClose,
		onShowCurrentCluster,
		onShowAllClusters,
		onMarkAllAsRead,
		onClearAll
	}: {
		hasNotifications: boolean;
		showAllClusters: boolean;
		onClose: () => void;
		onShowCurrentCluster: () => void;
		onShowAllClusters: () => void;
		onMarkAllAsRead: () => void;
		onClearAll: () => void;
	} = $props();
</script>

<div class="flex flex-col border-b border-gray-200 px-4 py-3 dark:border-gray-700">
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
		<div class="flex items-center gap-1 sm:gap-3">
			<a
				href="/settings/notifications"
				class="flex h-11 w-11 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-accent hover:text-gray-700 dark:text-gray-400 dark:hover:bg-accent dark:hover:text-gray-200"
				onclick={onClose}
				title="Notification Settings"
				aria-label="Notification Settings"
			>
				<Settings class="h-4 w-4" />
			</a>
			{#if hasNotifications}
				<button
					type="button"
					class="flex h-11 items-center px-2 text-xs text-blue-600 transition-colors hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 sm:px-3"
					onclick={onMarkAllAsRead}
				>
					Mark read
				</button>
				<button
					type="button"
					class="flex h-11 items-center px-2 text-xs text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 sm:px-3"
					onclick={onClearAll}
				>
					Clear
				</button>
			{/if}
		</div>
	</div>

	<div class="flex items-center gap-2 rounded-md bg-secondary/30 p-1">
		<button
			type="button"
			aria-pressed={!showAllClusters}
			class="flex h-11 flex-1 items-center justify-center rounded-sm px-2 py-1 text-[10px] font-medium transition-colors {showAllClusters
				? 'text-muted-foreground hover:bg-secondary/50'
				: 'bg-background text-foreground shadow-sm'}"
			onclick={onShowCurrentCluster}
		>
			Current Cluster
		</button>
		<button
			type="button"
			aria-pressed={showAllClusters}
			class="flex h-11 flex-1 items-center justify-center rounded-sm px-2 py-1 text-[10px] font-medium transition-colors {!showAllClusters
				? 'text-muted-foreground hover:bg-secondary/50'
				: 'bg-background text-foreground shadow-sm'}"
			onclick={onShowAllClusters}
		>
			All Clusters
		</button>
	</div>
</div>
