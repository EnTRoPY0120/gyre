<script lang="ts">
	import { resourceGroups } from '$lib/config/resources';
	import Icon from '$lib/components/ui/Icon.svelte';
	import { clusterStore } from '$lib/stores/cluster.svelte';

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

	// Show loading while cluster contexts are being fetched
	const isLoading = $derived(clusterStore.available.length === 0);

	// Get total counts across all groups - using $derived.by for complex logic
	const totals = $derived.by(() => {
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
		Sources: 'sideways-git',
		Kustomize: 'kustomize',
		Helm: 'helm',
		Notifications: 'bell',
		'Image Automation': 'layers'
	};

	// Map groups to their primary resource type for navigation
	const GroupRoutes: Record<string, string> = {
		Sources: 'gitrepositories',
		Kustomize: 'kustomizations',
		Helm: 'helmreleases',
		Notifications: 'alerts',
		'Image Automation': 'imagerepositories'
	};
</script>

<div class="animate-in fade-in space-y-8 duration-700">
	<!-- Welcome Header -->
	<div class="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
		<div>
			<h1 class="text-3xl font-bold tracking-tight text-foreground">Welcome to Gyre</h1>
			<p class="mt-2 text-lg text-muted-foreground">Monitor and manage your FluxCD resources</p>
		</div>
		<div
			class="flex items-center gap-3 rounded-full border border-sidebar-border bg-sidebar px-5 py-2.5 shadow-sm backdrop-blur-md"
		>
			{#if isLoading}
				<div
					class="size-2.5 animate-spin rounded-full border border-green-500 border-t-transparent"
				></div>
				<span
					class="text-xs leading-none font-black tracking-[0.2em] text-muted-foreground uppercase"
					>Initializing...</span
				>
			{:else}
				<div
					class="size-2.5 animate-pulse rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]"
				></div>
				<span
					class="text-xs leading-none font-black tracking-[0.2em] text-muted-foreground uppercase"
					>Cluster Live</span
				>
			{/if}
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4">
		<!-- Connection Card -->
		<div
			class="overflow-hidden rounded-3xl border border-border bg-card/40 shadow-sm transition-all hover:bg-card/60 hover:shadow-md md:col-span-2 lg:col-span-1"
		>
			<div class="p-6">
				<div class="mb-4 flex items-center justify-between">
					<p class="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase">
						Connectivity
					</p>
					<Icon name="monitor" size={16} class="text-muted-foreground/30" />
				</div>
				<div class="flex items-center gap-5">
					{#if isLoading}
						<div
							class="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/30"
						>
							<Icon name="loader" size={28} class="animate-spin text-muted-foreground/50" />
						</div>
						<div>
							<p class="font-display text-xl leading-none font-extrabold text-foreground">
								Loading...
							</p>
							<p class="mt-1.5 font-mono text-[11px] text-muted-foreground">
								Initializing cluster connection
							</p>
						</div>
					{:else if data.health.connected}
						<div
							class="flex h-14 w-14 items-center justify-center rounded-2xl border border-green-500/20 bg-green-500/10 text-green-500"
						>
							<Icon name="check" size={28} />
						</div>
						<div class="min-w-0">
							<p class="font-display text-xl leading-none font-extrabold text-foreground">Active</p>
							<p class="mt-1.5 font-mono text-[11px] font-bold break-all text-muted-foreground">
								{data.health.clusterName || 'Local-Cluster'}
							</p>
						</div>
					{:else}
						<div
							class="flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10 text-destructive"
						>
							<Icon name="x" size={28} />
						</div>
						<div>
							<p class="font-display text-xl leading-none font-extrabold">Down</p>
							<p
								class="mt-1.5 font-mono text-[11px] font-bold text-destructive text-muted-foreground uppercase"
							>
								Offline
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>

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
					<span
						class="font-display text-[10px] font-black tracking-widest text-destructive uppercase"
						>Alerts</span
					>
				</div>
			{/if}
		</div>
	</div>

	<!-- Resource Groups Section -->
	<div class="pt-4">
		<div class="mb-8 flex items-center justify-between">
			<h2 class="font-display text-2xl font-black tracking-tight text-foreground">
				Inventory Architecture
			</h2>
			<div
				class="mx-8 h-[2px] flex-1 bg-gradient-to-r from-border/50 via-border/10 to-transparent"
			></div>
		</div>

		{#if isLoading}
			<!-- Skeleton loading state for cards -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each resourceGroups}
					<div
						class="group relative overflow-hidden rounded-3xl border border-border bg-card/30 p-6 shadow-sm"
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
							{#each Array(3)}
								<div class="h-8 w-24 animate-pulse rounded-xl bg-muted/50"></div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each resourceGroups as group (group.name)}
					{@const counts = data.groupCounts[group.name] || {
						total: 0,
						healthy: 0,
						failed: 0,
						error: false
					}}
					{@const route = GroupRoutes[group.name]}
					<a
						href={route ? `/resources/${route}` : '/'}
						class="group relative overflow-hidden rounded-3xl border border-border bg-card/30 shadow-sm transition-all duration-500 hover:-translate-y-1 hover:border-primary/40 hover:bg-card/50 hover:shadow-xl"
					>
						<!-- Card Background Accent -->
						<div
							class="absolute -top-12 -right-12 size-32 rounded-full bg-primary/5 blur-3xl transition-all duration-700 group-hover:bg-primary/20"
						></div>

						<div class="border-b border-border/50 bg-muted/20 px-7 py-5">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-4">
									{#if GroupIcons[group.name]}
										<div
											class="flex size-10 items-center justify-center rounded-xl border border-border bg-background transition-all duration-300 group-hover:scale-110 group-hover:border-primary/50"
										>
											<Icon name={GroupIcons[group.name]} size={20} class="text-primary" />
										</div>
									{/if}
									<h3 class="font-display text-lg font-bold tracking-tight text-foreground">
										{group.name}
									</h3>
								</div>
								<!-- External link indicator -->
								<div class="text-muted-foreground/50 transition-all group-hover:text-primary">
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
										/>
									</svg>
								</div>
							</div>
						</div>

						<div class="p-7">
							{#if counts.error}
								<div
									class="flex items-center gap-2 rounded-lg border border-destructive/10 bg-destructive/5 p-3 text-destructive"
								>
									<Icon name="shield-alert" size={16} />
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
											<span>{Math.round((counts.healthy / (counts.total || 1)) * 100)}%</span>
										</div>
										<div class="h-2 w-full overflow-hidden rounded-full bg-muted/50 p-[1px]">
											<div
												class="h-full rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] transition-all duration-1000 ease-out"
												style="width: {(counts.healthy / (counts.total || 1)) * 100}%"
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

	<!-- System Shortcuts -->
	<div
		class="group relative overflow-hidden rounded-[2.5rem] border border-border bg-card/20 p-10 shadow-sm backdrop-blur-xl"
	>
		<div
			class="absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100"
		></div>

		<div class="relative z-10 flex flex-col justify-between gap-10 xl:flex-row xl:items-center">
			<div>
				<h2 class="font-display text-3xl font-black tracking-tight text-foreground">System Core</h2>
				<p class="mt-2 max-w-md text-sm font-medium text-muted-foreground">
					Immediate administrative access to cluster source controllers and orchestration engines.
				</p>
			</div>
			<div class="flex flex-wrap gap-4">
				<a
					href="/resources/gitrepositories"
					class="inline-flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-sm font-black tracking-widest text-primary-foreground uppercase shadow-2xl shadow-primary/20 transition-all hover:translate-y-[-4px] hover:shadow-primary/40 active:scale-95"
				>
					<Icon name="git-branch" size={20} />
					Sources
				</a>
				<a
					href="/resources/kustomizations"
					class="inline-flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar px-8 py-4 text-sm font-black tracking-widest text-foreground uppercase transition-all hover:translate-y-[-4px] hover:bg-muted active:scale-95"
				>
					<Icon name="file-cog" size={20} />
					Kustomize
				</a>
				<a
					href="/resources/helmreleases"
					class="inline-flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar px-8 py-4 text-sm font-black tracking-widest text-foreground uppercase transition-all hover:translate-y-[-4px] hover:bg-muted active:scale-95"
				>
					<Icon name="ship" size={20} />
					Helm
				</a>
				<button
					type="button"
					class="group/btn inline-flex items-center gap-3 rounded-2xl border border-sidebar-border bg-sidebar px-8 py-4 text-sm font-black tracking-widest text-foreground uppercase transition-all hover:translate-y-[-4px] hover:bg-muted active:scale-95"
					onclick={() => window.location.reload()}
				>
					<Icon
						name="refresh-cw"
						size={20}
						class="transition-transform duration-700 group-hover/btn:rotate-180"
					/>
					Sync
				</button>
			</div>
		</div>
	</div>
</div>
