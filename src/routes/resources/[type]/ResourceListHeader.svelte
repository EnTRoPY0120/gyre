<script lang="ts">
	import ViewToggle from '$lib/components/layout/ViewToggle.svelte';
	import RefreshControl from '$lib/components/layout/RefreshControl.svelte';

	let {
		displayName,
		description,
		isRefreshing,
		lastRefreshTime,
		onRefresh
	}: {
		displayName: string;
		description: string;
		isRefreshing: boolean;
		lastRefreshTime: Date | null;
		onRefresh: () => void;
	} = $props();
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="font-display text-2xl font-bold text-foreground">{displayName}</h1>
			<p class="mt-1 text-sm text-muted-foreground">{description}</p>
		</div>
		<ViewToggle />
	</div>
	<RefreshControl {isRefreshing} {lastRefreshTime} onRefresh={onRefresh} />
</div>
