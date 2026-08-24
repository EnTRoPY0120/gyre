<script lang="ts">
	import type { NotificationMessage } from '$lib/stores/events.svelte';
	import NotificationItem from './NotificationItem.svelte';

	let {
		notifications,
		showAllClusters,
		status,
		onClose,
		onPanelMount,
		onShowCurrentCluster,
		onShowAllClusters,
		onMarkAllAsRead,
		onClearAll,
		onMarkAsRead,
		onRemoveNotification
	}: {
		notifications: NotificationMessage[];
		showAllClusters: boolean;
		status: 'connected' | 'connecting' | 'disconnected' | 'error';
		onClose: () => void;
		onPanelMount: (panel: HTMLDivElement) => void;
		onShowCurrentCluster: () => void;
		onShowAllClusters: () => void;
		onMarkAllAsRead: () => void;
		onClearAll: () => void;
		onMarkAsRead: (id: string) => void;
		onRemoveNotification: (id: string, event: MouseEvent) => void;
	} = $props();

	let panelRef = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (panelRef) onPanelMount(panelRef);
	});

</script>

		<div
			bind:this={panelRef}
			role="region"
			aria-label="Notifications"
			tabindex="-1"
			class="fixed right-4 left-4 z-50 mt-2 rounded-lg border border-gray-200 bg-card shadow-lg sm:absolute sm:right-0 sm:left-auto sm:w-96 dark:border-gray-700 dark:bg-gray-800 focus:outline-none"
		>
			<!-- Header -->
			<div
				class="flex flex-col border-b border-gray-200 px-4 py-3 dark:border-gray-700"
			>
				<div class="flex items-center justify-between mb-2">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
					<div class="flex items-center gap-1 sm:gap-3">
						<a
							href="/settings/notifications"
							class="flex h-11 w-11 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-accent hover:text-gray-700 dark:text-gray-400 dark:hover:bg-accent dark:hover:text-gray-200"
							onclick={onClose}
							title="Notification Settings"
							aria-label="Notification Settings"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z"
								/>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
								/>
							</svg>
						</a>
						{#if notifications.length > 0}
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

				<!-- Cluster Filter Toggle -->
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

			<!-- Notification List -->
			<div class="max-h-96 overflow-y-auto" aria-live="polite" aria-label="Notification list">
				{#if notifications.length === 0}
					<div class="flex flex-col items-center justify-center py-8 text-center">
						<svg
							class="h-10 w-10 text-gray-300 dark:text-gray-600"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
							/>
						</svg>
						<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
							{showAllClusters ? 'No notifications' : 'No notifications in this cluster'}
						</p>
					</div>
				{:else}
					{#each notifications as notification (notification.id)}
						<NotificationItem
							{notification}
							{showAllClusters}
							onMarkAsRead={onMarkAsRead}
							onRemoveNotification={onRemoveNotification}
						/>
					{/each}
				{/if}
			</div>

			<!-- Footer with connection status -->
			<div
				class="flex items-center justify-between border-t border-gray-200 px-4 py-2 dark:border-gray-700"
			>
				<div class="flex items-center gap-2">
					<span
						class="h-2 w-2 rounded-full {status === 'connected'
							? 'bg-green-400'
							: status === 'connecting'
								? 'animate-pulse bg-yellow-400'
								: status === 'error'
									? 'bg-red-400'
									: 'bg-gray-400'}"
					></span>
					<span class="text-xs text-gray-500 dark:text-gray-400">
						{status === 'connected'
							? 'Live updates active'
							: status === 'connecting'
								? 'Connecting...'
								: status === 'error'
									? 'Connection error'
									: 'Disconnected'}
					</span>
				</div>
			</div>
		</div>
