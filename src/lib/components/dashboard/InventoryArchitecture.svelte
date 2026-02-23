<script lang="ts">
	import { resourceGroups } from '$lib/config/resources';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';

	interface Props {
		isLoading: boolean;
		groupCounts: Record<string, { total: number; healthy: number; failed: number; error: boolean }>;
	}

	let { isLoading, groupCounts }: Props = $props();
</script>

<!-- Resource Groups Section -->
<div class="pt-4">
	<div class="mb-8 flex items-center justify-between">
		<h2 class="font-display text-2xl font-black tracking-tight text-foreground">
			Inventory Architecture
		</h2>
		<div class="mx-8 h-[2px] flex-1 bg-gradient-to-r from-border/50 via-border/10 to-transparent"></div>
	</div>

	{#if isLoading}
		<!-- Skeleton loading state for cards -->
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each resourceGroups as group}
				<div
					class="relative overflow-hidden rounded-3xl border border-border bg-card/30 p-6 shadow-sm"
				>
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
	{:else}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each resourceGroups as group (group.name)}
				{@const counts = groupCounts[group.name] || {
					total: 0,
					healthy: 0,
					failed: 0,
					error: false
				}}
				{@const route = group.primaryRoute}
				{@const boundedPercent = Math.max(0, Math.min(100, (counts.healthy / (counts.total || 1)) * 100))}
				<a
					href={route ? `/resources/${route}` : undefined}
					aria-disabled={!route}
					class={cn(
						"relative overflow-hidden rounded-3xl border border-border bg-card/30 shadow-sm transition-all duration-500",
						route 
							? "group hover:-translate-y-1 hover:border-primary/40 hover:bg-card/50 hover:shadow-xl" 
							: "cursor-default opacity-80"
					)}
				>
					<!-- Card Background Accent -->
					<div
						class="absolute -top-12 -right-12 size-32 rounded-full bg-primary/5 blur-3xl transition-all duration-700 group-hover:bg-primary/20"
					></div>

					<div class="border-b border-border/50 bg-muted/20 px-7 py-5">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-4">
								{#if group.icon}
									<div
										class="flex size-10 items-center justify-center rounded-xl border border-border bg-background transition-all duration-300 group-hover:scale-110 group-hover:border-primary/50"
									>
										<Icon name={group.icon} size={20} class="text-primary" />
									</div>
								{/if}
								<h3 class="font-display text-lg font-bold tracking-tight text-foreground">
									{group.name}
								</h3>
							</div>
							<!-- External link indicator -->
							{#if route}
								<div class="text-muted-foreground/50 transition-all group-hover:text-primary">
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
										/>
									</svg>
								</div>
							{/if}
						</div>
					</div>

					<div class="p-7">
						{#if counts.error}
							<div
								class="flex items-center gap-2 rounded-lg border border-destructive/10 bg-destructive/5 p-3 text-destructive"
							>
								<Icon name="shield-alert" size={16} aria-hidden="true" />
								<p class="text-[11px] font-black tracking-wider uppercase">
									Sync Pipeline Interrupted
								</p>
							</div>
						{:else}
							<div class="mb-8 flex items-baseline gap-2">
								<span
									class="font-display text-5xl leading-none font-black tracking-tighter text-foreground"
									>{counts.total}</span
								>
								<span
									class="ml-1 font-display text-[11px] font-black tracking-[0.3em] text-muted-foreground uppercase"
									>Systems</span
								>
							</div>

							<div class="flex flex-col gap-5">
								<div class="space-y-2">
									<div
										class="flex items-center justify-between font-display text-[11px] font-black tracking-widest text-muted-foreground uppercase"
									>
										<span>Healthy State</span>
										<span>{Math.round(boundedPercent)}%</span>
									</div>
									<div class="h-2 w-full overflow-hidden rounded-full bg-muted/50 p-[1px]">
										<div
											class="h-full rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] transition-all duration-1000 ease-out"
											style="width: {boundedPercent}%"
										></div>
									</div>
								</div>

								{#if counts.failed > 0}
									<div
										class="flex items-center gap-3 rounded-xl border border-destructive/10 bg-destructive/5 p-2.5"
									>
										<div
											class="size-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]"
										></div>
										<span
											class="font-display text-[10px] font-black tracking-widest text-destructive/80 uppercase"
											>{counts.failed} critical obstacles identified</span
										>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Resource Type Tags (visual only, card is clickable) -->
						<div class="mt-8 flex flex-wrap gap-2 border-t border-border/30 pt-6">
							{#each group.resources.slice(0, 4) as resource (resource.type)}
								<span
									class="rounded-xl border border-border bg-background/50 px-4 py-2 text-[10px] font-black tracking-wider text-muted-foreground uppercase"
								>
									{resource.displayName}
								</span>
							{/each}
							{#if group.resources.length > 4}
								<span
									class="rounded-xl border border-border bg-background/50 px-4 py-2 text-[10px] font-black tracking-wider text-muted-foreground uppercase"
								>
									+{group.resources.length - 4} more
								</span>
							{/if}
						</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
