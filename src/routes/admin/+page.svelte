<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { GYRE_VERSION } from '$lib/config/version';
	import { ADMIN_HOME_FEATURES } from '$lib/navigation/admin';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const systemInfoItems = $derived.by(() =>
		[
			{ label: 'Version', value: `v${GYRE_VERSION}` },
			{ label: 'Deployment Mode', value: data.systemInfo.deploymentMode },
			{ label: 'Cluster Access', value: data.systemInfo.clusterAccess },
			{ label: 'Database Engine', value: data.systemInfo.databaseEngine },
			{ label: 'Environment', value: data.systemInfo.environment }
		].filter((item): item is { label: string; value: string } => Boolean(item.value))
	);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-foreground">Administration</h1>
		<p class="text-muted-foreground">Manage system settings, users, and cluster configurations</p>
	</div>

	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
		{#each ADMIN_HOME_FEATURES as feature (feature.label)}
			<a
				href={feature.href}
				class="group relative flex flex-col rounded-2xl border border-border bg-card/40 p-6 transition-all duration-300 hover:border-primary/30 hover:bg-card/60 hover:shadow-2xl hover:shadow-primary/5"
			>
				<div
					class="mb-4 flex h-12 w-12 items-center justify-center rounded-xl {feature.bg} {feature.color} transition-transform duration-300 group-hover:scale-110"
				>
					<Icon name={feature.icon} size={24} />
				</div>
				<h3 class="mb-2 text-lg font-bold text-foreground group-hover:text-primary">{feature.label}</h3>
				<p class="text-sm leading-relaxed text-muted-foreground group-hover:text-foreground">
					{feature.description}
				</p>

				<div
					class="mt-6 flex items-center text-xs font-bold tracking-wider text-primary uppercase opacity-0 transition-opacity duration-300 group-hover:opacity-100"
				>
					Open {feature.label}
					<Icon name="arrow-right" size={14} class="ml-2" />
				</div>
			</a>
		{/each}
	</div>

	<!-- System Info Section -->
	<div class="mt-12 rounded-2xl border border-border bg-card/20 p-8">
		<div class="flex items-start gap-4">
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
			>
				<Icon name="settings" size={20} />
			</div>
			<div>
				<h2 class="text-lg font-bold text-foreground">System Configuration</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					Runtime details are derived from the current server environment and active Gyre
					configuration.
				</p>
				<div class="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
					{#each systemInfoItems as item (item.label)}
						<div class="flex flex-col rounded-xl border border-border/60 bg-background/40 p-4">
							<span class="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
								{item.label}
							</span>
							<span class="mt-1 font-mono text-sm text-foreground">{item.value}</span>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
