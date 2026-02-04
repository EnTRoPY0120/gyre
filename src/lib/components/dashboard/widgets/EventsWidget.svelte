<script lang="ts">
	import type { DashboardWidget } from '$lib/stores/dashboards.svelte';
	import { formatDistanceToNow } from 'date-fns';
	import { onMount } from 'svelte';

	interface K8sEvent {
		type?: string;
		reason?: string;
		message?: string;
		lastTimestamp?: string;
		firstTimestamp?: string;
		metadata?: { uid?: string };
		source?: { component?: string };
	}

	let { widget, config }: { widget: DashboardWidget; config: Record<string, unknown> } = $props();

	let events = $state<K8sEvent[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	async function fetchEvents() {
		loading = true;
		try {
			// We need a global events API if no type/name provided
			// For now, let's fetch events for a specific resource if configured,
			// otherwise maybe use a placeholder or recent cluster events
			const res = await fetch('/api/flux/events'); // Need to check if this exists
			if (res.ok) {
				const data = await res.json();
				events = data.events?.slice(0, config.limit || 5) || [];
			} else {
				error = 'Failed to load events';
			}
		} catch {
			error = 'Error fetching events';
		} finally {
			loading = false;
		}
	}

	onMount(fetchEvents);
</script>

<div class="space-y-3" data-widget-id={widget.id}>
	{#if loading}
		<div class="flex items-center justify-center py-4">
			<div
				class="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent"
			></div>
		</div>
	{:else if error}
		<div class="py-4 text-center text-[11px] font-medium text-red-500">
			{error}
		</div>
	{:else if events.length === 0}
		<div class="py-4 text-center text-xs text-muted-foreground italic">No recent events</div>
	{:else}
		{#each events as event, index (event.metadata?.uid || event.lastTimestamp || `event-${index}`)}
			<div class="flex flex-col gap-1 border-l-2 border-border/50 pl-3">
				<div class="flex items-center justify-between">
					<span
						class={`text-[10px] font-black uppercase ${event.type === 'Warning' ? 'text-red-500' : 'text-primary'}`}
					>
						{event.reason}
					</span>
					<span class="text-[9px] text-muted-foreground">
						{formatDistanceToNow(
							new Date(String(event.lastTimestamp || event.firstTimestamp || Date.now())),
							{
								addSuffix: true
							}
						)}
					</span>
				</div>
				<p class="line-clamp-2 text-[11px] leading-tight text-foreground/90">{event.message}</p>
				<p class="text-[9px] font-medium text-muted-foreground uppercase">
					{(event.source as Record<string, unknown>)?.component || 'unknown'}
				</p>
			</div>
		{/each}
	{/if}
</div>
