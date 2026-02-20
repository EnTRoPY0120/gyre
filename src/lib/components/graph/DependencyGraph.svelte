<script lang="ts">
	import { SvelteFlow, Background, Controls, MiniMap, type Node, type Edge, type NodeTypes } from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import ResourceNode from './ResourceNode.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { buildGraph, KIND_COLORS } from '$lib/utils/graph';
	import type { FluxResource } from '$lib/server/kubernetes/flux/types';
	import type { ResourceRelationship } from '$lib/utils/relationships';

	interface Props {
		/** Full resource list — used for cluster-wide view */
		allResources?: FluxResource[];
		/** Relationships between resources */
		relationships?: ResourceRelationship[];
		/** Pre-built nodes (from buildResourceGraph, for the per-resource tab) */
		nodes?: Node[];
		/** Pre-built edges */
		edges?: Edge[];
		/** Node ids involved in circular dependencies */
		circularIds?: string[];
		/** Show filter controls (cluster-wide mode only) */
		showControls?: boolean;
	}

	let {
		allResources = [],
		relationships = [],
		nodes: propNodes,
		edges: propEdges,
		circularIds = [],
		showControls = true
	}: Props = $props();

	const nodeTypes: NodeTypes = { resource: ResourceNode };

	// Filter state (cluster-wide mode)
	const allKinds = $derived([...new Set(allResources.map((r) => r.kind ?? ''))].sort());
	let hiddenKinds = $state<Set<string>>(new Set());
	let showOnlyFailed = $state(false);

	// Use pre-built nodes/edges or build from raw data (one pass)
	const graphData = $derived.by(() => {
		if (propNodes !== undefined && propEdges !== undefined) {
			return { nodes: propNodes, edges: propEdges };
		}
		return buildGraph(allResources, relationships, { hiddenKinds, showOnlyFailed, circularIds });
	});

	const nodes = $derived(graphData.nodes);
	const edges = $derived(graphData.edges);

	// Navigate to resource detail on node click
	const KIND_PLURAL: Record<string, string> = {
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

	function onNodeClick({ node }: { node: Node }) {
		if (!node.data) return;
		const d = node.data as {
			kind: string;
			namespace?: string;
			label: string;
			isPhantom?: boolean;
		};
		if (d.isPhantom) return;
		const plural = KIND_PLURAL[d.kind];
		if (!plural) return;
		goto(resolve(`/resources/${plural}/${d.namespace ?? 'default'}/${d.label}`));
	}

	function toggleKind(kind: string) {
		const next = new Set(hiddenKinds);
		if (next.has(kind)) next.delete(kind);
		else next.add(kind);
		hiddenKinds = next;
	}

	function minimapNodeColor(node: Node): string {
		const d = node.data as { status?: string; kindColor?: string };
		if (d.status === 'ready') return '#22c55e';
		if (d.status === 'failed') return '#ef4444';
		if (d.status === 'suspended') return '#f59e0b';
		return d.kindColor ?? '#6b7280';
	}
</script>

<div class="relative flex h-full w-full flex-col overflow-hidden">
	<!-- Filter bar: only in cluster-wide mode -->
	{#if showControls && propNodes === undefined}
		<div class="flex flex-wrap items-center gap-2 border-b border-border bg-sidebar/70 px-4 py-2 backdrop-blur-sm">
			<button
				onclick={() => (showOnlyFailed = !showOnlyFailed)}
				class="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors {showOnlyFailed
					? 'border-red-500/40 bg-red-500/10 text-red-500'
					: 'border-border bg-background text-muted-foreground hover:text-foreground'}"
			>
				<span
					class="inline-block h-2 w-2 rounded-full"
					style="background-color: {showOnlyFailed ? '#ef4444' : '#6b7280'};"
				></span>
				Failed / Suspended only
			</button>

			{#if allKinds.length > 0}
				<div class="h-4 w-px bg-border"></div>
				<div class="flex flex-wrap gap-1">
					{#each allKinds as kind (kind)}
						{@const hidden = hiddenKinds.has(kind)}
						{@const color = KIND_COLORS[kind] ?? '#6b7280'}
						<button
							onclick={() => toggleKind(kind)}
							class="rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all duration-150 {hidden
								? 'border-border bg-background text-muted-foreground opacity-50'
								: 'border-transparent text-white'}"
							style={hidden ? '' : `background-color: ${color};`}
							title="{hidden ? 'Show' : 'Hide'} {kind}"
						>
							{kind}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Circular dependency warning -->
	{#if circularIds.length > 0}
		<div class="flex items-center gap-2 border-b border-red-500/20 bg-red-500/8 px-4 py-1.5">
			<svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0 fill-none stroke-red-500 stroke-2">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01"
				/>
			</svg>
			<span class="text-xs font-medium text-red-600 dark:text-red-400">
				{circularIds.length} circular {circularIds.length === 1 ? 'dependency' : 'dependencies'}
				detected — affected nodes highlighted in red
			</span>
		</div>
	{/if}

	<!-- Graph canvas -->
	<div class="min-h-0 flex-1">
		{#if nodes.length === 0}
			<div class="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
				<svg viewBox="0 0 24 24" class="h-12 w-12 fill-none stroke-current stroke-1 opacity-20">
					<circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" />
				</svg>
				<p class="text-sm">No resources to display</p>
				{#if hiddenKinds.size > 0 || showOnlyFailed}
					<button
						onclick={() => { hiddenKinds = new Set(); showOnlyFailed = false; }}
						class="text-xs text-primary underline underline-offset-2 hover:opacity-80"
					>
						Clear filters
					</button>
				{/if}
			</div>
		{:else}
			<SvelteFlow
				{nodes}
				{edges}
				{nodeTypes}
				fitView
				fitViewOptions={{ padding: 0.15 }}
				minZoom={0.05}
				maxZoom={2.5}
				proOptions={{ hideAttribution: true }}
				onnodeclick={onNodeClick}
			>
				<Background patternColor="currentColor" class="text-muted-foreground/12" gap={24} size={1} />
				<Controls showLock={false} />
				<MiniMap zoomable pannable nodeColor={minimapNodeColor} maskColor="rgba(0,0,0,0.12)" />
			</SvelteFlow>
		{/if}
	</div>
</div>
