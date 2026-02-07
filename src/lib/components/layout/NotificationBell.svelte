<script lang="ts">
	import { websocketStore, type NotificationMessage } from '$lib/stores/websocket.svelte';

	let isOpen = $state(false);
	let dropdownRef = $state<HTMLDivElement | null>(null);

	const notifications = $derived(websocketStore.notifications);
	const unreadCount = $derived(websocketStore.unreadCount);
	const status = $derived(websocketStore.status);

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function closeDropdown() {
		isOpen = false;
	}

	function handleClickOutside(event: MouseEvent) {
		if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
			closeDropdown();
		}
	}

	function markAsRead(id: string) {
		websocketStore.markAsRead(id);
	}

	function markAllAsRead() {
		websocketStore.markAllAsRead();
	}

	function clearAll() {
		websocketStore.clearAll();
		closeDropdown();
	}

	function removeNotification(id: string, event: MouseEvent) {
		event.stopPropagation();
		websocketStore.removeNotification(id);
	}

	function getNotificationIcon(type: NotificationMessage['type']) {
		switch (type) {
			case 'success':
				return 'M5 13l4 4L19 7';
			case 'warning':
				return 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
			case 'error':
				return 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
			default:
				return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
		}
	}

	function getNotificationColor(type: NotificationMessage['type']) {
		switch (type) {
			case 'success':
				return 'text-green-500';
			case 'warning':
				return 'text-yellow-500';
			case 'error':
				return 'text-red-500';
			default:
				return 'text-blue-500';
		}
	}

	function formatTime(date: Date): string {
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffSeconds = Math.floor(diffMs / 1000);
		const diffMinutes = Math.floor(diffSeconds / 60);
		const diffHours = Math.floor(diffMinutes / 60);

		if (diffSeconds < 60) return 'just now';
		if (diffMinutes < 60) return `${diffMinutes}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return date.toLocaleDateString();
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
		type="button"
		class="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-accent hover:text-gray-700 dark:text-gray-400 dark:hover:bg-accent dark:hover:text-gray-200"
		onclick={toggleDropdown}
		aria-label="Notifications"
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

		<!-- Connection Status Dot -->
		<span
			class="absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full {status === 'connected'
				? 'bg-green-400'
				: status === 'connecting'
					? 'animate-pulse bg-yellow-400'
					: 'bg-gray-400'}"
		></span>
	</button>

	<!-- Dropdown -->
	{#if isOpen}
		<div
			class="fixed right-4 left-4 z-50 mt-2 rounded-lg border border-gray-200 bg-card shadow-lg sm:absolute sm:right-0 sm:left-auto sm:w-96 dark:border-gray-700 dark:bg-gray-800"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700"
			>
				<h3 class="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
				<div class="flex items-center gap-2">
					{#if notifications.length > 0}
						<button
							type="button"
							class="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
							onclick={markAllAsRead}
						>
							Mark all read
						</button>
						<button
							type="button"
							class="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
							onclick={clearAll}
						>
							Clear all
						</button>
					{/if}
				</div>
			</div>

			<!-- Notification List -->
			<div class="max-h-96 overflow-y-auto">
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
						<p class="mt-2 text-sm text-gray-500 dark:text-gray-400">No notifications</p>
					</div>
				{:else}
					{#each notifications as notification (notification.id)}
						<div
							role="button"
							tabindex="0"
							class="w-full border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent focus:bg-accent focus:outline-none dark:border-gray-700 dark:hover:bg-accent dark:focus:bg-accent {notification.read
								? 'opacity-60'
								: ''}"
							onclick={() => markAsRead(notification.id)}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									markAsRead(notification.id);
									e.preventDefault();
								}
							}}
						>
							<div class="flex items-start gap-3">
								<!-- Icon -->
								<div class="flex-shrink-0 pt-0.5">
									<svg
										class="h-5 w-5 {getNotificationColor(notification.type)}"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d={getNotificationIcon(notification.type)}
										/>
									</svg>
								</div>

								<!-- Content -->
								<div class="min-w-0 flex-1">
									<div class="flex items-center justify-between">
										<p
											class="text-sm font-medium text-gray-900 dark:text-gray-100 {notification.read
												? ''
												: 'font-semibold'}"
										>
											{notification.title}
										</p>
										<button
											type="button"
											class="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
											onclick={(e) => removeNotification(notification.id, e)}
											aria-label="Remove notification"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												/>
											</svg>
										</button>
									</div>
									<p class="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
										{notification.message}
									</p>
									<p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
										{formatTime(notification.timestamp)}
									</p>
								</div>

								<!-- Unread indicator -->
								{#if !notification.read}
									<div class="flex-shrink-0">
										<span class="h-2 w-2 rounded-full bg-blue-500"></span>
									</div>
								{/if}
							</div>
						</div>
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
	{/if}
</div>
