<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { formatTimestamp } from '$lib/utils/flux';
	import type { FluxResource } from '$lib/types/flux';
	import { cn } from '$lib/utils';

	interface Props {
		data: {
			imageRepositories: FluxResource[];
			imagePolicies: FluxResource[];
			imageUpdateAutomations: FluxResource[];
			error?: string;
		};
	}

	let { data }: Props = $props();

	const repos = $derived(data.imageRepositories);
	const policies = $derived(data.imagePolicies);
	const automations = $derived(data.imageUpdateAutomations);

	// Derived statistics
	const stats = $derived.by(() => {
		const totalImages = repos.length;
		const totalPolicies = policies.length;
		const totalAutomations = automations.length;

		const suspendedCount = [
			...repos,
			...policies,
			...automations
		].filter(r => r.spec?.suspend === true).length;

		const failedCount = [
			...repos,
			...policies,
			...automations
		].filter(r => {
			const status = r.status as any;
			return status?.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'False');
		}).length;

		return {
			totalImages,
			totalPolicies,
			totalAutomations,
			suspendedCount,
			failedCount
		};
	});

	function getResourceStatus(resource: FluxResource): 'ready' | 'failed' | 'suspended' | 'pending' {
		if (resource.spec?.suspend) return 'suspended';

		const status = resource.status as any;
		if (!status?.conditions) return 'pending';

		const readyCondition = status.conditions.find((c: any) => c.type === 'Ready');
		if (!readyCondition) return 'pending';

		if (readyCondition.status === 'True') return 'ready';
		if (readyCondition.status === 'False') return 'failed';

		return 'pending';
	}

	const StatusColors = {
		ready: 'text-green-500 bg-green-500/10 border-green-500/20',
		failed: 'text-destructive bg-destructive/10 border-destructive/20',
		suspended: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
		pending: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
	};
</script>

<svelte:head>
	<title>Image Automation Dashboard | Gyre</title>
</svelte:head>

<div class="space-y-8 animate-in fade-in duration-700">
	<!-- Header -->
	<div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
		<div>
			<h1 class="text-3xl font-black tracking-tight text-foreground">Image Automation</h1>
			<p class="mt-2 text-muted-foreground font-medium">
				Monitor and manage automated container image updates across your cluster
			</p>
		</div>

		<div class="flex items-center gap-3 self-start rounded-2xl border border-border bg-card/40 px-4 py-2 shadow-sm backdrop-blur-md">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
				<Icon name="refresh-cw" size={20} />
			</div>
			<div>
				<p class="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Sync Engine</p>
				<p class="text-sm font-bold text-foreground">Automation Active</p>
			</div>
		</div>
	</div>

	{#if data.error}
		<div class="flex items-center gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-destructive">
			<Icon name="shield-alert" size={24} />
			<p class="font-bold">{data.error}</p>
		</div>
	{/if}

	<!-- Stats Overview -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 md:gap-6">
		<div class="rounded-3xl border border-border bg-card/40 p-6 shadow-sm">
			<p class="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase mb-4">Repositories</p>
			<div class="flex items-baseline gap-2">
				<span class="text-4xl font-black tracking-tighter">{stats.totalImages}</span>
				<span class="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Tracked</span>
			</div>
		</div>

		<div class="rounded-3xl border border-border bg-card/40 p-6 shadow-sm">
			<p class="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase mb-4">Policies</p>
			<div class="flex items-baseline gap-2">
				<span class="text-4xl font-black tracking-tighter">{stats.totalPolicies}</span>
				<span class="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Active</span>
			</div>
		</div>

		<div class="rounded-3xl border border-border bg-card/40 p-6 shadow-sm">
			<p class="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase mb-4">Automations</p>
			<div class="flex items-baseline gap-2">
				<span class="text-4xl font-black tracking-tighter">{stats.totalAutomations}</span>
				<span class="text-[10px] font-black tracking-widest text-muted-foreground uppercase">Engines</span>
			</div>
		</div>

		<div class="rounded-3xl border border-border bg-card/40 p-6 shadow-sm transition-all hover:border-destructive/20">
			<p class="text-[10px] font-black tracking-[0.2em] text-destructive uppercase mb-4">Failures</p>
			<div class="flex items-baseline gap-2">
				<span class="text-4xl font-black tracking-tighter text-destructive">{stats.failedCount}</span>
				<span class="text-[10px] font-black tracking-widest text-destructive uppercase">Alerts</span>
			</div>
		</div>

		<div class="rounded-3xl border border-border bg-card/40 p-6 shadow-sm">
			<p class="text-[10px] font-black tracking-[0.2em] text-zinc-500 uppercase mb-4">Suspended</p>
			<div class="flex items-baseline gap-2">
				<span class="text-4xl font-black tracking-tighter text-zinc-500">{stats.suspendedCount}</span>
				<span class="text-[10px] font-black tracking-widest text-zinc-500 uppercase">Paused</span>
			</div>
		</div>
	</div>

	<!-- Main Content Sections -->
	<div class="grid grid-cols-1 gap-8 xl:grid-cols-2">

		<!-- Image Repositories Section -->
		<div class="rounded-[2rem] border border-border bg-card/30 p-8 shadow-sm">
			<div class="flex items-center justify-between mb-8">
				<div class="flex items-center gap-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">
						<Icon name="cloud" size={20} />
					</div>
					<h2 class="text-xl font-black tracking-tight">Tracked Image Repositories</h2>
				</div>
				<a href="/resources/imagerepositories" class="text-xs font-black tracking-widest text-primary uppercase hover:underline">View All</a>
			</div>

			<div class="space-y-4">
				{#each repos.slice(0, 5) as repo}
					{@const status = getResourceStatus(repo)}
					{@const lastScan = (repo.status as any)?.lastScanResult}
					<div class="group relative overflow-hidden rounded-2xl border border-border bg-background/50 p-5 transition-all hover:border-primary/30 hover:bg-background/80">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<h3 class="font-bold text-foreground truncate">{repo.metadata.name}</h3>
									<span class={cn('px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest border uppercase', StatusColors[status])}>
										{status}
									</span>
								</div>
								<p class="text-xs text-muted-foreground font-mono truncate">{repo.spec?.image}</p>
							</div>

							<div class="flex flex-col items-start sm:items-end gap-2 shrink-0">
								{#if lastScan?.tagCount !== undefined}
									<div class="flex items-center gap-2">
										<span class="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Tags Found:</span>
										<span class="text-sm font-bold text-primary">{lastScan.tagCount}</span>
									</div>
								{/if}
								{#if lastScan?.scanTime}
									<p class="text-[10px] font-medium text-muted-foreground">Scanned {formatTimestamp(lastScan.scanTime)}</p>
								{/if}
							</div>
						</div>

						{#if lastScan?.latestTags?.length > 0}
							<div class="mt-4 flex flex-wrap gap-1.5 pt-4 border-t border-border/50">
								{#each lastScan.latestTags.slice(0, 3) as tag}
									<span class="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[10px] font-bold font-mono">
										{tag}
									</span>
								{/each}
								{#if lastScan.latestTags.length > 3}
									<span class="text-[10px] text-muted-foreground self-center">+{lastScan.latestTags.length - 3} more</span>
								{/if}
							</div>
						{/if}
					</div>
				{:else}
					<div class="py-12 text-center">
						<div class="mx-auto w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
							<Icon name="cloud-off" size={24} class="text-muted-foreground" />
						</div>
						<p class="text-sm font-bold text-muted-foreground">No Image Repositories discovered</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Image Policies Section -->
		<div class="rounded-[2rem] border border-border bg-card/30 p-8 shadow-sm">
			<div class="flex items-center justify-between mb-8">
				<div class="flex items-center gap-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
						<Icon name="shield-check" size={20} />
					</div>
					<h2 class="text-xl font-black tracking-tight text-foreground">Active Image Policies</h2>
				</div>
				<a href="/resources/imagepolicies" class="text-xs font-black tracking-widest text-primary uppercase hover:underline">View All</a>
			</div>

			<div class="space-y-4">
				{#each policies.slice(0, 5) as policy}
					{@const status = getResourceStatus(policy)}
					{@const latestImage = (policy.status as any)?.latestImage}
					<div class="group relative overflow-hidden rounded-2xl border border-border bg-background/50 p-5 transition-all hover:border-primary/30 hover:bg-background/80">
						<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
							<div class="min-w-0">
								<div class="flex items-center gap-2 mb-1">
									<h3 class="font-bold text-foreground truncate">{policy.metadata.name}</h3>
									<span class={cn('px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest border uppercase', StatusColors[status])}>
										{status}
									</span>
								</div>
								<div class="flex items-center gap-2 text-xs text-muted-foreground">
									<Icon name="cloud" size={12} />
									<span class="font-mono truncate">{(policy.spec as any)?.imageRepositoryRef?.name}</span>
								</div>
							</div>

							<div class="flex flex-col items-start sm:items-end shrink-0">
								<div class="px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/20">
									<p class="text-[9px] font-black text-primary uppercase tracking-[0.2em] mb-0.5">Policy Type</p>
									<p class="text-xs font-bold text-foreground">
										{(policy.spec as any)?.policy?.semver ? 'SemVer (' + (policy.spec as any).policy.semver.range + ')' : 
										 (policy.spec as any)?.policy?.alphabetical ? 'Alphabetical' : 
										 (policy.spec as any)?.policy?.numerical ? 'Numerical' : 'Unknown'}
									</p>
								</div>
							</div>
						</div>

						{#if latestImage}
							<div class="mt-4 p-3 rounded-xl bg-emerald-500/[0.03] border border-emerald-500/10 flex items-center justify-between">
								<div class="flex items-center gap-2 overflow-hidden">
									<div class="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
									<p class="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold truncate">
										{latestImage.split(':').pop()}
									</p>
								</div>
								<span class="text-[9px] font-black text-emerald-600/60 dark:text-emerald-400/40 uppercase tracking-widest ml-4 shrink-0">Selected</span>
							</div>
						{/if}
					</div>
				{:else}
					<div class="py-12 text-center">
						<div class="mx-auto w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
							<Icon name="shield-alert" size={24} class="text-muted-foreground" />
						</div>
						<p class="text-sm font-bold text-muted-foreground">No Image Policies configured</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Automation History Section -->
		<div class="rounded-[2rem] border border-border bg-card/30 p-8 shadow-sm xl:col-span-2">
			<div class="flex items-center justify-between mb-8">
				<div class="flex items-center gap-4">
					<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
						<Icon name="git-commit" size={20} />
					</div>
					<h2 class="text-xl font-black tracking-tight">Image Update Automations</h2>
				</div>
				<a href="/resources/imageupdateautomations" class="text-xs font-black tracking-widest text-primary uppercase hover:underline">View All</a>
			</div>

			<div class="overflow-x-auto rounded-2xl border border-border bg-background/30 overflow-hidden">
				<table class="w-full text-sm text-left">
					<thead class="bg-muted/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b border-border">
						<tr>
							<th class="px-6 py-4">Resource</th>
							<th class="px-6 py-4">Status</th>
							<th class="px-6 py-4">Git Reference</th>
							<th class="px-6 py-4">Last Commit</th>
							<th class="px-6 py-4 text-right">Last Run</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/50">
						{#each automations as auto}
							{@const status = getResourceStatus(auto)}
							{@const lastRun = (auto.status as any)?.lastAutomationRunTime}
							{@const lastPushCommit = (auto.status as any)?.lastPushCommit}
							{@const lastPushTime = (auto.status as any)?.lastPushTime}
							<tr class="hover:bg-card/40 transition-colors">
								<td class="px-6 py-5">
									<div class="flex flex-col">
										<span class="font-bold text-foreground">{auto.metadata.name}</span>
										<span class="text-[10px] text-muted-foreground font-mono">{auto.metadata.namespace}</span>
									</div>
								</td>
								<td class="px-6 py-5">
									<span class={cn('px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest border uppercase', StatusColors[status])}>
										{status}
									</span>
								</td>
								<td class="px-6 py-5">
									<div class="flex items-center gap-2 text-xs">
										<Icon name="git-branch" size={14} class="text-muted-foreground" />
										<span class="font-medium">{(auto.spec as any)?.git?.checkout?.ref?.branch || 'main'}</span>
									</div>
								</td>
								<td class="px-6 py-5">
									{#if lastPushCommit}
										<div class="flex flex-col">
											<div class="flex items-center gap-2">
												<span class="size-1.5 rounded-full bg-blue-500 shrink-0"></span>
												<span class="font-mono text-xs font-bold text-foreground">{lastPushCommit.substring(0, 12)}</span>
											</div>
											{#if lastPushTime}
												<span class="text-[10px] text-muted-foreground ml-3.5">{formatTimestamp(lastPushTime)}</span>
											{/if}
										</div>
									{:else}
										<span class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">No Commits yet</span>
									{/if}
								</td>
								<td class="px-6 py-5 text-right">
									{#if lastRun}
										<span class="text-xs font-medium">{formatTimestamp(lastRun)}</span>
									{:else}
										<span class="text-xs text-muted-foreground">Never</span>
									{/if}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="px-6 py-12 text-center">
									<div class="flex flex-col items-center">
										<Icon name="refresh-cw" size={32} class="text-muted-foreground/30 mb-4" />
										<p class="font-bold text-muted-foreground">No Automations configured in this cluster</p>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

	</div>
</div>
