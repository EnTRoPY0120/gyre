<script lang="ts">
	import type { NotificationMessage } from '$lib/stores/events.svelte';

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

	function isNestedInteractiveTarget(
		event: MouseEvent | KeyboardEvent,
		currentTarget: EventTarget | null
	): boolean {
		if (!(event.target instanceof Element) || !(currentTarget instanceof Element)) {
			return false;
		}

		const interactiveAncestor = event.target.closest(
			'button, a, input, select, textarea, summary, [role="button"], [role="link"]'
		);
		return interactiveAncestor !== null && interactiveAncestor !== currentTarget;
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
						<div
							role="button"
							tabindex="0"
							class="w-full border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent focus:bg-accent focus:outline-none dark:border-gray-700 dark:hover:bg-accent dark:focus:bg-accent {notification.read
								? 'opacity-60'
								: ''}"
							onclick={(event) => {
								if (isNestedInteractiveTarget(event, event.currentTarget)) {
									return;
								}
								onMarkAsRead(notification.id);
							}}
							onkeydown={(e) => {
								if (isNestedInteractiveTarget(e, e.currentTarget)) {
									return;
								}
								if (e.key === 'Enter' || e.key === ' ') {
									onMarkAsRead(notification.id);
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
											onclick={(e) => onRemoveNotification(notification.id, e)}
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
									<div class="mt-1 flex items-center justify-between">
										<p class="text-[10px] text-gray-400 dark:text-gray-500">
											{formatTime(notification.timestamp)}
										</p>
										{#if showAllClusters}
											<span
												class="rounded bg-secondary/50 px-1 py-0.5 font-mono text-[9px] text-muted-foreground"
											>
												{notification.clusterId === 'in-cluster' ? 'In-cluster' : notification.clusterId}
											</span>
										{/if}
									</div>
								</div>

								<!-- Unread indicator (decorative – read state conveyed by opacity on parent) -->
								{#if !notification.read}
									<div aria-hidden="true" class="flex-shrink-0">
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
