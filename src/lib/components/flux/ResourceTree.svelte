<script lang="ts">
	import Icon from '$lib/components/ui/Icon.svelte';
	import { cn } from '$lib/utils';
	import type { ResourceRef } from '$lib/utils/relationships';
	import ResourceTree from './ResourceTree.svelte';

	interface TreeNode {
		ref: ResourceRef;
		status?: 'ready' | 'pending' | 'failed' | 'suspended';
		children: TreeNode[];
		expanded?: boolean;
	}

	interface Props {
		nodes: TreeNode[];
		level?: number;
		onNodeClick?: (node: TreeNode) => void;
	}

	let { nodes, level = 0, onNodeClick }: Props = $props();

	// Track expanded state locally
	let expandedNodes = $state<Set<string>>(new Set());

	function getNodeKey(node: TreeNode): string {
		return `${node.ref.kind}/${node.ref.namespace}/${node.ref.name}`;
	}

	function toggleExpand(node: TreeNode) {
		const key = getNodeKey(node);
		if (expandedNodes.has(key)) {
			expandedNodes.delete(key);
		} else {
			expandedNodes.add(key);
		}
		expandedNodes = new Set(expandedNodes);
	}

	function isExpanded(node: TreeNode): boolean {
		return expandedNodes.has(getNodeKey(node));
	}

	const statusColors = {
		ready: 'bg-green-500',
		pending: 'bg-yellow-500',
		failed: 'bg-red-500',
		suspended: 'bg-zinc-500'
	};

	const statusIcons = {
		ready: 'check-circle',
		pending: 'clock',
		failed: 'x-circle',
		suspended: 'pause-circle'
	};

	const kindIcons: Record<string, string> = {
		GitRepository: 'git-branch',
		HelmRepository: 'library',
		HelmChart: 'package',
		Bucket: 'bucket',
		OCIRepository: 'cloud',
		Kustomization: 'file-cog',
		HelmRelease: 'ship',
		Alert: 'shield-alert',
		Provider: 'radio',
		Receiver: 'activity',
		ImageRepository: 'image',
		ImagePolicy: 'shield',
		ImageUpdateAutomation: 'refresh-cw',
		Deployment: 'box',
		Service: 'globe',
		ConfigMap: 'file-text',
		Secret: 'key',
		Namespace: 'folder'
	};
</script>

<div class="space-y-1" style="padding-left: {level * 16}px">
	{#each nodes as node}
		{@const hasChildren = node.children && node.children.length > 0}
		{@const expanded = isExpanded(node)}
		{@const status = node.status || 'pending'}
		{@const iconName = kindIcons[node.ref.kind] || 'file'}

		<div class="group">
			<!-- Node row -->
			<button
				class={cn(
					'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all',
					'hover:bg-accent/50',
					level === 0 && 'font-medium'
				)}
				onclick={() => {
					if (hasChildren) toggleExpand(node);
					onNodeClick?.(node);
				}}
			>
				<!-- Expand/collapse icon -->
				{#if hasChildren}
					<Icon
						name="chevron-right"
						size={14}
						class={cn('text-muted-foreground transition-transform', expanded && 'rotate-90')}
					/>
				{:else}
					<div class="w-3.5"></div>
				{/if}

				<!-- Status indicator -->
				<div
					class={cn('size-2 rounded-full', statusColors[status])}
					title={status.charAt(0).toUpperCase() + status.slice(1)}
				></div>

				<!-- Kind icon -->
				<Icon name={iconName} size={16} class="text-muted-foreground" />

				<!-- Resource info -->
				<div class="flex flex-1 items-center gap-2 overflow-hidden">
					<span class="truncate text-foreground">{node.ref.name}</span>
					<span class="truncate text-xs text-muted-foreground/60">
						{node.ref.kind}
					</span>
				</div>

				<!-- Namespace badge -->
				{#if node.ref.namespace}
					<span
						class="rounded bg-secondary/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
					>
						{node.ref.namespace}
					</span>
				{/if}

				<!-- Children count -->
				{#if hasChildren}
					<span
						class="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
					>
						{node.children.length}
					</span>
				{/if}
			</button>

			<!-- Children (recursive) -->
			{#if hasChildren && expanded}
				<div class="mt-1 ml-[7px] border-l border-border/30">
					<ResourceTree nodes={node.children} level={level + 1} {onNodeClick} />
				</div>
			{/if}
		</div>
	{/each}
</div>
