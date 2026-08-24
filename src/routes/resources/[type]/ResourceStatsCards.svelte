<script lang="ts">
	import type { ResourceStats } from './resource-stats';

	let { stats }: { stats: ResourceStats } = $props();
</script>

<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-5">
	<div class="rounded-xl border border-border bg-card p-4 transition-colors">
		<p class="text-sm font-medium text-muted-foreground">Total</p>
		<p class="mt-1 text-2xl font-bold text-foreground">{stats.total}</p>
	</div>
	<div
		class="rounded-xl border border-green-500/20 bg-card p-4 transition-colors hover:bg-green-500/[0.02]"
	>
		<p class="text-sm font-medium text-green-600 dark:text-green-500">Healthy</p>
		<p class="mt-1 text-2xl font-bold text-green-600 dark:text-green-500">{stats.healthy}</p>
	</div>
	<div
		class="rounded-xl border border-primary/20 bg-card p-4 transition-colors hover:bg-primary/[0.02]"
	>
		<p class="text-sm font-medium text-primary">Progressing</p>
		<p class="mt-1 text-2xl font-bold text-primary">{stats.progressing}</p>
	</div>
	<div
		class="rounded-xl border border-destructive/20 bg-card p-4 transition-colors hover:bg-destructive/[0.02]"
	>
		<p class="text-sm font-medium text-destructive">Failed</p>
		<p class="mt-1 text-2xl font-bold text-destructive">{stats.failed}</p>
	</div>
	<div
		class="rounded-xl border border-amber-500/20 bg-card p-4 transition-colors hover:bg-amber-500/[0.02]"
	>
		<p class="text-sm font-medium text-amber-500">Suspended</p>
		<p class="mt-1 text-2xl font-bold text-amber-500">{stats.suspended}</p>
	</div>
</div>
