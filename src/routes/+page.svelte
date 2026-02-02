<script lang="ts">
	import { resourceGroups } from '$lib/config/resources';
	import Icon from '$lib/components/ui/Icon.svelte';

	interface Props {
		data: {
			health: {
				connected: boolean;
				clusterName?: string;
			};
			groupCounts: Record<
				string,
				{ total: number; healthy: number; failed: number; error: boolean }
			>;
		};
	}

	let { data }: Props = $props();

	// Get total counts across all groups
	const totals = $derived(() => {
		let total = 0;
		let healthy = 0;
		let failed = 0;

		for (const counts of Object.values(data.groupCounts)) {
			total += counts.total;
			healthy += counts.healthy;
			failed += counts.failed;
		}

		return { total, healthy, failed };
	});

	const GroupIcons: Record<string, string> = {
		'Sources': 'sideways-git',
		'Kustomize': 'kustomize',
		'Helm': 'helm',
		'Notifications': 'bell',
		'Image Automation': 'layers'
	};
</script>

<div class="space-y-8 animate-in fade-in duration-700">
	<!-- Welcome Header -->
	<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
		<div>
			<h1 class="text-4xl font-extrabold tracking-tight text-foreground flex items-center gap-4 font-display">
				<Icon name="flux" size={36} class="text-primary" />
				Dashboard
			</h1>
			<p class="mt-2 text-muted-foreground font-medium text-lg">FluxCD, Visualized</p>
		</div>
		<div class="flex items-center gap-3 px-5 py-2.5 rounded-full bg-sidebar border border-sidebar-border shadow-sm backdrop-blur-md">
			<div class="size-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
			<span class="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground leading-none">Cluster Live</span>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
		<!-- Connection Card -->
		<div class="md:col-span-2 lg:col-span-1 overflow-hidden rounded-3xl border border-border bg-card/40 shadow-sm transition-all hover:bg-card/60 hover:shadow-md">
			<div class="p-6">
				<div class="flex items-center justify-between mb-4">
					<p class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Connectivity</p>
					<Icon name="monitor" size={16} class="text-muted-foreground/30" />
				</div>
				<div class="flex items-center gap-5">
					{#if data.health.connected}
						<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-green-500 border border-green-500/20">
							<Icon name="check" size={28} />
						</div>
						<div class="min-w-0">
							<p class="text-xl font-extrabold leading-none font-display text-foreground">Active</p>
							<p class="text-[11px] font-bold text-muted-foreground mt-1.5 font-mono break-all">
								{data.health.clusterName || 'Local-Cluster'}
							</p>
						</div>
					{:else}
						<div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive border border-destructive/20">
							<Icon name="x" size={28} />
						</div>
						<div>
							<p class="text-xl font-extrabold leading-none font-display">Down</p>
							<p class="text-[11px] font-bold text-muted-foreground mt-1.5 text-destructive font-mono uppercase">Offline</p>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Total Resources -->
		<div class="overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm transition-all hover:bg-card/60 hover:shadow-md">
			<div class="flex items-center justify-between mb-4">
				<p class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Total</p>
				<Icon name="activity" size={16} class="text-primary/30" />
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-4xl font-black text-foreground font-display tracking-tighter">{totals().total}</span>
				<span class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Global</span>
			</div>
		</div>

		<!-- Healthy Card -->
		<div class="overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm transition-all hover:border-green-500/20 hover:bg-green-500/[0.02]">
			<div class="flex items-center justify-between mb-4">
				<p class="text-[10px] font-black uppercase tracking-[0.2em] text-green-600 dark:text-green-500 font-display">Healthy</p>
				<Icon name="check" size={16} class="text-green-500/30" />
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-4xl font-black text-foreground font-display tracking-tighter">{totals().healthy}</span>
				<span class="text-[10px] font-black text-green-600 dark:text-green-500 uppercase tracking-widest font-display">Synced</span>
			</div>
		</div>

		<!-- Failed Card -->
		<div class="overflow-hidden rounded-3xl border border-border bg-card/40 p-6 shadow-sm transition-all hover:border-destructive/20 hover:bg-destructive/[0.02]">
			<div class="flex items-center justify-between mb-4">
				<p class="text-[10px] font-black uppercase tracking-[0.2em] text-destructive font-display">Failed</p>
				<Icon name="shield-alert" size={16} class="text-destructive/30" />
			</div>
			<div class="flex items-baseline gap-2">
				<span class="text-4xl font-black text-foreground font-display tracking-tighter">{totals().failed}</span>
				<span class="text-[10px] font-black text-destructive uppercase tracking-widest font-display">Alerts</span>
			</div>
		</div>
	</div>

	<!-- Resource Groups Section -->
	<div class="pt-4">
		<div class="flex items-center justify-between mb-8">
			<h2 class="text-2xl font-black text-foreground tracking-tight font-display">Inventory Architecture</h2>
			<div class="h-[2px] flex-1 mx-8 bg-gradient-to-r from-border/50 via-border/10 to-transparent"></div>
		</div>
		
		<div class="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
			{#each resourceGroups as group}
				{@const counts = data.groupCounts[group.name] || { total: 0, healthy: 0, failed: 0, error: false }}
				<div class="group relative overflow-hidden rounded-3xl border border-border bg-card/30 shadow-sm transition-all duration-500 hover:bg-card/50 hover:border-primary/40 hover:-translate-y-1 hover:shadow-xl">
					<!-- Card Background Accent -->
					<div class="absolute -right-12 -top-12 size-32 rounded-full bg-primary/5 blur-3xl transition-all duration-700 group-hover:bg-primary/20"></div>
					
					<div class="border-b border-border/50 bg-muted/20 px-7 py-5">
						<div class="flex items-center gap-4">
							{#if GroupIcons[group.name]}
								<div class="flex size-10 items-center justify-center rounded-xl bg-background border border-border group-hover:border-primary/50 group-hover:scale-110 transition-all duration-300">
									<Icon name={GroupIcons[group.name]} size={20} class="text-primary" />
								</div>
							{/if}
							<h3 class="font-bold text-lg text-foreground tracking-tight font-display">{group.name}</h3>
						</div>
					</div>
					
					<div class="p-7">
						{#if counts.error}
							<div class="flex items-center gap-2 text-destructive bg-destructive/5 p-3 rounded-lg border border-destructive/10">
								<Icon name="shield-alert" size={16} />
								<p class="text-[11px] font-black uppercase tracking-wider">Sync Pipeline Interrupted</p>
							</div>
						{:else}
							<div class="mb-8 flex items-baseline gap-2">
								<span class="text-5xl font-black text-foreground font-display tracking-tighter leading-none">{counts.total}</span>
								<span class="text-[11px] font-black text-muted-foreground uppercase tracking-[0.3em] font-display ml-1">Systems</span>
							</div>
							
							<div class="flex flex-col gap-5">
								<div class="space-y-2">
									<div class="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-muted-foreground font-display">
										<span>Healthy State</span>
										<span>{Math.round((counts.healthy / (counts.total || 1)) * 100)}%</span>
									</div>
									<div class="w-full h-2 bg-muted/50 rounded-full overflow-hidden p-[1px]">
										<div 
											class="h-full bg-green-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(34,197,94,0.4)]" 
											style="width: {(counts.healthy / (counts.total || 1)) * 100}%"
										></div>
									</div>
								</div>

								{#if counts.failed > 0}
									<div class="flex items-center gap-3 bg-destructive/5 border border-destructive/10 p-2.5 rounded-xl">
										<div class="size-2 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.4)]"></div>
										<span class="text-[10px] font-black uppercase tracking-widest text-destructive/80 font-display">{counts.failed} critical obstacles identified</span>
									</div>
								{/if}
							</div>
						{/if}

						<!-- Action Tags -->
						<div class="mt-8 pt-6 border-t border-border/30 flex flex-wrap gap-2">
							{#each group.resources as resource}
								<a
									href="/resources/{resource.type}"
									class="rounded-xl bg-background/50 border border-border px-4 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-lg active:scale-95 active:translate-y-0"
								>
									{resource.displayName}
								</a>
							{/each}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- System Shortcuts -->
	<div class="rounded-[2.5rem] border border-border bg-card/20 p-10 shadow-sm backdrop-blur-xl relative overflow-hidden group">
		<div class="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100"></div>
		
		<div class="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-10">
			<div>
				<h2 class="text-3xl font-black text-foreground tracking-tight font-display">System Core</h2>
				<p class="text-sm text-muted-foreground font-medium mt-2 max-w-md">Immediate administrative access to cluster source controllers and orchestration engines.</p>
			</div>
			<div class="flex flex-wrap gap-4">
				<a
					href="/resources/gitrepositories"
					class="inline-flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-2xl shadow-primary/20 transition-all hover:translate-y-[-4px] hover:shadow-primary/40 active:scale-95"
				>
					<Icon name="git-branch" size={20} />
					Sources
				</a>
				<a
					href="/resources/kustomizations"
					class="inline-flex items-center gap-3 rounded-2xl bg-sidebar border border-sidebar-border px-8 py-4 text-sm font-black uppercase tracking-widest text-foreground transition-all hover:bg-muted hover:translate-y-[-4px] active:scale-95"
				>
					<Icon name="file-cog" size={20} />
					Kustomize
				</a>
				<a
					href="/resources/helmreleases"
					class="inline-flex items-center gap-3 rounded-2xl bg-sidebar border border-sidebar-border px-8 py-4 text-sm font-black uppercase tracking-widest text-foreground transition-all hover:bg-muted hover:translate-y-[-4px] active:scale-95"
				>
					<Icon name="ship" size={20} />
					Helm
				</a>
				<button
					type="button"
					class="inline-flex items-center gap-3 rounded-2xl bg-sidebar border border-sidebar-border px-8 py-4 text-sm font-black uppercase tracking-widest text-foreground transition-all hover:bg-muted hover:translate-y-[-4px] active:scale-95 group/btn"
					onclick={() => window.location.reload()}
				>
					<Icon name="refresh-cw" size={20} class="group-hover/btn:rotate-180 transition-transform duration-700" />
					Sync
				</button>
			</div>
		</div>
	</div>
</div>
