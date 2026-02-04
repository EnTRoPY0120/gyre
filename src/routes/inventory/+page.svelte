<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import ResourceTree from '$lib/components/flux/ResourceTree.svelte';
	import { cn } from '$lib/utils';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { ResourceRef } from '$lib/utils/relationships';

	interface TreeNode {
		ref: ResourceRef;
		status?: 'ready' | 'pending' | 'failed' | 'suspended';
		children: TreeNode[];
	}

	interface Props {
		data: {
			relationships: Record<string, unknown>[];
			trees: {
				sources: TreeNode[];
				applications: TreeNode[];
				notifications: TreeNode[];
				imageAutomation: TreeNode[];
			};
			stats: {
				sources: number;
				applications: number;
				totalRelationships: number;
				ready: number;
				failed: number;
				suspended: number;
			};
		};
	}

	let { data }: Props = $props();

	// Handle node click to navigate to resource detail
	function handleNodeClick(node: TreeNode) {
		const typeMapping: Record<string, string> = {
			GitRepository: 'gitrepositories',
			HelmRepository: 'helmrepositories',
			HelmChart: 'helmcharts',
			Bucket: 'buckets',
			OCIRepository: 'ocirepositories',
			Kustomization: 'kustomizations',
			HelmRelease: 'helmreleases',
			Alert: 'alerts',
			Provider: 'providers',
			Receiver: 'receivers',
			ImageRepository: 'imagerepositories',
			ImagePolicy: 'imagepolicies',
			ImageUpdateAutomation: 'imageupdateautomations'
		};

		const type = typeMapping[node.ref.kind];
		if (type) {
			goto(resolve(`/resources/${type}/${node.ref.namespace}/${node.ref.name}`));
		}
	}

	const categories = $derived([
		{
			name: 'Sources',
			icon: 'git-branch',
			description: 'Git repositories, Helm repositories, OCI registries, and S3 buckets',
			nodes: data.trees.sources,
			color: 'from-blue-500/20 to-cyan-500/20',
			borderColor: 'border-blue-500/30'
		},
		{
			name: 'Applications',
			icon: 'layers',
			description: 'Kustomizations and Helm releases that deploy your applications',
			nodes: data.trees.applications,
			color: 'from-green-500/20 to-emerald-500/20',
			borderColor: 'border-green-500/30'
		},
		{
			name: 'Image Automation',
			icon: 'refresh-cw',
			description: 'Automatic image updates with policies and automation rules',
			nodes: data.trees.imageAutomation,
			color: 'from-purple-500/20 to-pink-500/20',
			borderColor: 'border-purple-500/30'
		},
		{
			name: 'Notifications',
			icon: 'bell',
			description: 'Alerts, providers, and webhook receivers',
			nodes: data.trees.notifications,
			color: 'from-amber-500/20 to-orange-500/20',
			borderColor: 'border-amber-500/30'
		}
	]);
</script>

<svelte:head>
	<title>Inventory | Gyre</title>
</svelte:head>

<div class="min-h-screen bg-background p-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="font-display text-3xl font-black tracking-tight">Resource Inventory</h1>
		<p class="mt-2 text-muted-foreground">
			Explore FluxCD resources and their relationships across your cluster
		</p>
	</div>

	<!-- Stats Overview -->
	<div class="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
		<div class="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm">
			<div class="flex items-center gap-2 text-muted-foreground">
				<Icon name="git-branch" size={16} />
				<span class="text-xs font-medium tracking-wider uppercase">Sources</span>
			</div>
			<p class="mt-2 text-2xl font-bold">{data.stats.sources}</p>
		</div>

		<div class="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm">
			<div class="flex items-center gap-2 text-muted-foreground">
				<Icon name="layers" size={16} />
				<span class="text-xs font-medium tracking-wider uppercase">Apps</span>
			</div>
			<p class="mt-2 text-2xl font-bold">{data.stats.applications}</p>
		</div>

		<div class="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm">
			<div class="flex items-center gap-2 text-muted-foreground">
				<Icon name="link" size={16} />
				<span class="text-xs font-medium tracking-wider uppercase">Relations</span>
			</div>
			<p class="mt-2 text-2xl font-bold">{data.stats.totalRelationships}</p>
		</div>

		<div class="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm">
			<div class="flex items-center gap-2 text-green-500">
				<Icon name="check-circle" size={16} />
				<span class="text-xs font-medium tracking-wider uppercase">Ready</span>
			</div>
			<p class="mt-2 text-2xl font-bold text-green-500">{data.stats.ready}</p>
		</div>

		<div class="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm">
			<div class="flex items-center gap-2 text-red-500">
				<Icon name="x-circle" size={16} />
				<span class="text-xs font-medium tracking-wider uppercase">Failed</span>
			</div>
			<p class="mt-2 text-2xl font-bold text-red-500">{data.stats.failed}</p>
		</div>

		<div class="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm">
			<div class="flex items-center gap-2 text-zinc-500">
				<Icon name="pause-circle" size={16} />
				<span class="text-xs font-medium tracking-wider uppercase">Suspended</span>
			</div>
			<p class="mt-2 text-2xl font-bold text-zinc-500">{data.stats.suspended}</p>
		</div>
	</div>

	<!-- Resource Trees by Category -->
	<div class="grid gap-6 lg:grid-cols-2">
		{#each categories as category (category.name)}
			<div
				class={cn(
					'overflow-hidden rounded-xl border bg-gradient-to-br backdrop-blur-sm',
					category.color,
					category.borderColor
				)}
			>
				<!-- Category Header -->
				<div class="border-b border-border/50 bg-card/40 p-4">
					<div class="flex items-center gap-3">
						<div class="rounded-lg bg-card/60 p-2">
							<Icon name={category.icon} size={20} class="text-foreground" />
						</div>
						<div>
							<h2 class="font-semibold">{category.name}</h2>
							<p class="text-xs text-muted-foreground">{category.description}</p>
						</div>
						<span class="ml-auto rounded-full bg-card/60 px-2.5 py-1 text-sm font-medium">
							{category.nodes.length}
						</span>
					</div>
				</div>

				<!-- Tree Content -->
				<div class="max-h-[400px] overflow-y-auto p-4">
					{#if category.nodes.length > 0}
						<ResourceTree nodes={category.nodes} onNodeClick={handleNodeClick} />
					{:else}
						<div class="py-8 text-center text-sm text-muted-foreground">
							No {category.name.toLowerCase()} configured
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Relationships Section -->
	{#if data.relationships.length > 0}
		<div class="mt-8">
			<h2 class="mb-4 text-lg font-semibold">Resource Relationships</h2>
			<div class="overflow-hidden rounded-xl border border-border bg-card/60 backdrop-blur-sm">
				<div class="max-h-[300px] overflow-y-auto">
					<table class="w-full text-sm">
						<thead class="sticky top-0 bg-muted/80 backdrop-blur-sm">
							<tr>
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">Source</th>
								<th class="px-4 py-3 text-center font-medium text-muted-foreground">Relationship</th
								>
								<th class="px-4 py-3 text-left font-medium text-muted-foreground">Target</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/50">
							{#each data.relationships.slice(0, 50) as rel, index (index)}
								<tr class="hover:bg-accent/30">
									<td class="px-4 py-2">
										<div class="flex items-center gap-2">
											<span class="font-mono text-xs text-muted-foreground"
												>{(rel.source as ResourceRef).kind}</span
											>
											<span class="font-medium">{(rel.source as ResourceRef).name}</span>
										</div>
									</td>
									<td class="px-4 py-2 text-center">
										<span
											class="inline-flex items-center gap-1 rounded-full bg-secondary/50 px-2 py-0.5 text-xs"
										>
											<Icon name="arrow-right" size={12} />
											{rel.label || rel.type}
										</span>
									</td>
									<td class="px-4 py-2">
										<div class="flex items-center gap-2">
											<span class="font-mono text-xs text-muted-foreground"
												>{(rel.target as ResourceRef).kind}</span
											>
											<span class="font-medium">{(rel.target as ResourceRef).name}</span>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if data.relationships.length > 50}
					<div
						class="border-t border-border/50 bg-muted/30 px-4 py-2 text-center text-xs text-muted-foreground"
					>
						Showing 50 of {data.relationships.length} relationships
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
