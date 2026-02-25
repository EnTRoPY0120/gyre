import { onDestroy } from 'svelte';
import { SvelteDate } from 'svelte/reactivity';
import { preferences } from '$lib/stores/preferences.svelte';
import { invalidateAll } from '$app/navigation';

export interface AutoRefreshOptions {
	/**
	 * Custom invalidation function. If not provided, invalidateAll() is used.
	 */
	invalidate?: () => Promise<void>;
}

/**
 * Creates an auto-refresh mechanism that polls data based on user preferences.
 * Returns a cleanup function and state management utilities.
 */
export function createAutoRefresh(options: AutoRefreshOptions = {}) {
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let isRefreshing = $state(false);
	let lastRefreshTime = $state<Date | null>(null);

	function startPolling() {
		stopPolling();

		if (preferences.autoRefresh && preferences.refreshInterval > 0) {
			intervalId = setInterval(async () => {
				await refresh();
			}, preferences.refreshInterval * 1000);
		}
	}

	function stopPolling() {
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}

	async function refresh() {
		if (isRefreshing) return;

		isRefreshing = true;
		try {
			if (options.invalidate) {
				await options.invalidate();
			} else {
				await invalidateAll();
			}
			lastRefreshTime = new SvelteDate();
		} finally {
			isRefreshing = false;
		}
	}

	// Use $effect to reactively start/stop polling
	$effect(() => {
		if (preferences.autoRefresh) {
			startPolling();
		} else {
			stopPolling();
		}

		return () => {
			stopPolling();
		};
	});

	// Cleanup on destroy
	onDestroy(() => {
		stopPolling();
	});

	return {
		get isRefreshing() {
			return isRefreshing;
		},
		get lastRefreshTime() {
			return lastRefreshTime;
		},
		refresh,
		startPolling,
		stopPolling
	};
}

/**
 * Format the last refresh time as a human-readable string
 */
export function formatLastRefresh(date: Date | null): string {
	if (!date) return 'Never';

	const now = new SvelteDate();
	const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diff < 5) return 'Just now';
	if (diff < 60) return `${diff}s ago`;
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	return date.toLocaleTimeString();
}
