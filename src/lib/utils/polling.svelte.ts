import { onDestroy } from 'svelte';
import { get } from 'svelte/store';
import { SvelteDate } from 'svelte/reactivity';
import { preferences } from '$lib/stores/preferences';
import { invalidateAll } from '$app/navigation';

/**
 * Creates an auto-refresh mechanism that polls data based on user preferences.
 * Returns a cleanup function and state management utilities.
 */
export function createAutoRefresh() {
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let isRefreshing = $state(false);
	let lastRefreshTime = $state<Date | null>(null);

	function startPolling() {
		stopPolling();
		const prefs = get(preferences);

		if (prefs.autoRefresh && prefs.refreshInterval > 0) {
			intervalId = setInterval(async () => {
				await refresh();
			}, prefs.refreshInterval * 1000);
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
			await invalidateAll();
			lastRefreshTime = new SvelteDate();
		} finally {
			isRefreshing = false;
		}
	}

	// Subscribe to preference changes
	const unsubscribe = preferences.subscribe((prefs) => {
		if (prefs.autoRefresh) {
			startPolling();
		} else {
			stopPolling();
		}
	});

	// Initial start if auto-refresh is enabled
	const initialPrefs = get(preferences);
	if (initialPrefs.autoRefresh) {
		startPolling();
	}

	// Cleanup on destroy
	onDestroy(() => {
		stopPolling();
		unsubscribe();
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
