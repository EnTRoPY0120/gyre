<script lang="ts">
	import type { NotificationMessage } from '$lib/stores/events.svelte';

	let {
		notification,
		showAllClusters,
		onMarkAsRead,
		onRemoveNotification
	}: {
		notification: NotificationMessage;
		showAllClusters: boolean;
		onMarkAsRead: (id: string) => void;
		onRemoveNotification: (id: string, event: MouseEvent) => void;
	} = $props();

	function isNestedInteractiveTarget(
		event: MouseEvent | KeyboardEvent,
		currentTarget: EventTarget | null
	): boolean {
		if (!(event.target instanceof Element) || !(currentTarget instanceof Element)) return false;

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
		const diffSeconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
		const diffMinutes = Math.floor(diffSeconds / 60);
		const diffHours = Math.floor(diffMinutes / 60);

		if (diffSeconds < 60) return 'just now';
		if (diffMinutes < 60) return `${diffMinutes}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return date.toLocaleDateString();
	}
</script>

<div
	role="button"
	tabindex="0"
	class="w-full border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent focus:bg-accent focus:outline-none dark:border-gray-700 dark:hover:bg-accent dark:focus:bg-accent {notification.read
		? 'opacity-60'
		: ''}"
	onclick={(event) => {
		if (!isNestedInteractiveTarget(event, event.currentTarget)) onMarkAsRead(notification.id);
	}}
	onkeydown={(event) => {
		if (isNestedInteractiveTarget(event, event.currentTarget)) return;
		if (event.key === 'Enter' || event.key === ' ') {
			onMarkAsRead(notification.id);
			event.preventDefault();
		}
	}}
>
	<div class="flex items-start gap-3">
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
					onclick={(event) => onRemoveNotification(notification.id, event)}
					aria-label="Remove notification"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
			<p class="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">{notification.message}</p>
			<div class="mt-1 flex items-center justify-between">
				<p class="text-[10px] text-gray-400 dark:text-gray-500">{formatTime(notification.timestamp)}</p>
				{#if showAllClusters}
					<span class="rounded bg-secondary/50 px-1 py-0.5 font-mono text-[9px] text-muted-foreground">
						{notification.clusterId === 'in-cluster' ? 'In-cluster' : notification.clusterId}
					</span>
				{/if}
			</div>
		</div>

		{#if !notification.read}
			<div aria-hidden="true" class="flex-shrink-0">
				<span class="h-2 w-2 rounded-full bg-blue-500"></span>
			</div>
		{/if}
	</div>
</div>
