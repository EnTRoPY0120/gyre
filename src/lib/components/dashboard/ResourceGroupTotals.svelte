<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		isLoading: boolean;
		groupCounts: Record<string, { total: number; healthy: number; failed: number; error: boolean }>;
	}

	let { isLoading, groupCounts }: Props = $props();

	// Get total counts across all groups - using $derived.by for complex logic
	const totals = $derived.by(() => {
		let total = 0;
		let healthy = 0;
		let failed = 0;

		for (const counts of Object.values(groupCounts)) {
			total += counts.total;
			healthy += counts.healthy;
			failed += counts.failed;
		}

		return { total, healthy, failed };
	});
</script>

<!-- Total Resources -->
<div
	class="overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm transition-all hover:bg-card/60 hover:shadow-md"
>
	<div class="mb-4 flex items-center justify-between">
		<p class="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase">Total</p>
		<Icon name="activity" size={16} class="text-primary/30" />
	</div>
	{#if isLoading}
		<div class="flex items-baseline gap-2">
			<div class="h-10 w-16 animate-pulse rounded bg-muted/50"></div>
		</div>
	{:else}
		<div class="flex items-baseline gap-2">
			<span class="font-display text-4xl font-black tracking-tighter text-foreground"
				>{totals.total}</span
			>
			<span class="text-[10px] font-black tracking-widest text-muted-foreground uppercase"
				>Global</span
			>
		</div>
	{/if}
</div>

<!-- Healthy Card -->
<div
	class="overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm transition-all hover:border-green-500/20 hover:bg-green-500/[0.02]"
>
	<div class="mb-4 flex items-center justify-between">
		<p
			class="font-display text-[10px] font-black tracking-[0.2em] text-green-600 uppercase dark:text-green-500"
		>
			Healthy
		</p>
		<Icon name="check" size={16} class="text-green-500/30" />
	</div>
	{#if isLoading}
		<div class="flex items-baseline gap-2">
			<div class="h-10 w-16 animate-pulse rounded bg-muted/50"></div>
		</div>
	{:else}
		<div class="flex items-baseline gap-2">
			<span class="font-display text-4xl font-black tracking-tighter text-foreground"
				>{totals.healthy}</span
			>
			<span
				class="font-display text-[10px] font-black tracking-widest text-green-600 uppercase dark:text-green-500"
				>Synced</span
			>
		</div>
	{/if}
</div>

<!-- Failed Card -->
<div
	class="overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm transition-all hover:border-destructive/20 hover:bg-destructive/[0.02]"
>
	<div class="mb-4 flex items-center justify-between">
		<p class="font-display text-[10px] font-black tracking-[0.2em] text-destructive uppercase">
			Failed
		</p>
		<Icon name="shield-alert" size={16} class="text-destructive/30" />
	</div>
	{#if isLoading}
		<div class="flex items-baseline gap-2">
			<div class="h-10 w-8 animate-pulse rounded bg-muted/50"></div>
		</div>
	{:else}
		<div class="flex items-baseline gap-2">
			<span class="font-display text-4xl font-black tracking-tighter text-foreground"
				>{totals.failed}</span
			>
			<span class="font-display text-[10px] font-black tracking-widest text-destructive uppercase"
				>Alerts</span
			>
		</div>
	{/if}
</div>
