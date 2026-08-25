<script lang="ts">
	import type { NotificationMessage } from '$lib/stores/events.svelte';
	import NotificationItem from './NotificationItem.svelte';

	let {
		notifications,
		showAllClusters,
		onMarkAsRead,
		onRemoveNotification
	}: {
		notifications: NotificationMessage[];
		showAllClusters: boolean;
		onMarkAsRead: (id: string) => void;
		onRemoveNotification: (id: string, event: MouseEvent) => void;
	} = $props();
</script>

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
