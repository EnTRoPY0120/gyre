<script lang="ts">
	import type { NotificationMessage } from '$lib/stores/events.svelte';
	import NotificationDropdownFooter from './NotificationDropdownFooter.svelte';
	import NotificationDropdownHeader from './NotificationDropdownHeader.svelte';
	import NotificationDropdownList from './NotificationDropdownList.svelte';

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
	<NotificationDropdownHeader
		hasNotifications={notifications.length > 0}
		{showAllClusters}
		{onClose}
		{onShowCurrentCluster}
		{onShowAllClusters}
		{onMarkAllAsRead}
		{onClearAll}
	/>
	<NotificationDropdownList
		{notifications}
		{showAllClusters}
		{onMarkAsRead}
		{onRemoveNotification}
	/>
	<NotificationDropdownFooter {status} />
</div>
