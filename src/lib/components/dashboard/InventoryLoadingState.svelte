<script lang="ts">
	import { resourceGroups } from '$lib/config/resources';
</script>

<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
	{#each resourceGroups as group}
		<div class="relative overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm">
			<div class="mb-6 flex items-center gap-4">
				<div class="size-10 animate-pulse rounded-xl bg-muted/50"></div>
				<div class="h-6 w-32 animate-pulse rounded bg-muted/50"></div>
			</div>
			<div class="mb-6">
				<div class="h-12 w-20 animate-pulse rounded bg-muted/50"></div>
			</div>
			<div class="space-y-3">
				<div class="h-2 w-full animate-pulse rounded-full bg-muted/50"></div>
			</div>
			<div class="mt-8 flex flex-wrap gap-2">
				{#each Array.from({ length: 3 }) as _}
					<div class="h-8 w-24 animate-pulse rounded-xl bg-muted/50"></div>
				{/each}
			</div>
		</div>
	{/each}
</div>
