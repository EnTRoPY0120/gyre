<script lang="ts">
	import { eventsStore } from '$lib/stores/events.svelte';
	import { clusterStore } from '$lib/stores/cluster.svelte';
	import NotificationDropdown from './NotificationDropdown.svelte';

	let isOpen = $state(false);
	let showAllClusters = $state(false);
	let dropdownRef = $state<HTMLDivElement | null>(null);
	let dropdownPanelRef = $state<HTMLDivElement | null>(null);
	let bellButtonRef = $state<HTMLButtonElement | null>(null);

	const currentCluster = $derived(clusterStore.current || 'in-cluster');
	const notifications = $derived(
		showAllClusters
			? eventsStore.notifications
			: eventsStore.notifications.filter((notification) => notification.clusterId === currentCluster)
	);
	const unreadCount = $derived(
		showAllClusters
			? eventsStore.unreadCount
			: eventsStore.clusterUnreadCounts[currentCluster] || 0
	);
	const status = $derived(eventsStore.status);

	function toggleDropdown() {
		if (isOpen) {
			isOpen = false;
			bellButtonRef?.focus();
		} else {
			isOpen = true;
			setTimeout(() => dropdownPanelRef?.focus(), 0);
		}
	}

	function closeDropdown() {
		isOpen = false;
		bellButtonRef?.focus();
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			closeDropdown();
		}
	}

	function markAsRead(id: string) {
		eventsStore.markAsRead(id);
	}

	function markAllAsRead() {
		eventsStore.markAllAsRead(showAllClusters ? undefined : currentCluster);
	}

	function clearAll() {
		eventsStore.clearAll(showAllClusters ? undefined : currentCluster);
		if (notifications.length === 0) closeDropdown();
	}

	function removeNotification(id: string, event: MouseEvent) {
		event.stopPropagation();
		eventsStore.removeNotification(id);
	}

	function setDropdownPanelRef(panel: HTMLDivElement) {
		dropdownPanelRef = panel;
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleClickOutside);
		} else {
			document.removeEventListener('click', handleClickOutside);
		}

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});
</script>

<div class="relative" bind:this={dropdownRef}>
	<!-- Bell Button -->
	<button
		bind:this={bellButtonRef}
		type="button"
		class="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-accent hover:text-gray-700 dark:text-gray-400 dark:hover:bg-accent dark:hover:text-gray-200"
		onclick={toggleDropdown}
		aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
		aria-expanded={isOpen}
		aria-haspopup="dialog"
	>
		<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
			/>
		</svg>

		<!-- Unread Badge -->
		{#if unreadCount > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white"
			>
				{unreadCount > 9 ? '9+' : unreadCount}
			</span>
		{/if}

		<!-- Connection Status Dot (decorative – text label in footer conveys status) -->
		<span
			aria-hidden="true"
			class="absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full {status === 'connected'
				? 'bg-green-400'
				: status === 'connecting'
					? 'animate-pulse bg-yellow-400'
					: 'bg-gray-400'}"
		></span>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<NotificationDropdown
			{notifications}
			{showAllClusters}
			{status}
			onClose={closeDropdown}
			onPanelMount={setDropdownPanelRef}
			onShowCurrentCluster={() => (showAllClusters = false)}
			onShowAllClusters={() => (showAllClusters = true)}
			onMarkAllAsRead={markAllAsRead}
			onClearAll={clearAll}
			onMarkAsRead={markAsRead}
			onRemoveNotification={removeNotification}
		/>
	{/if}
</div>
