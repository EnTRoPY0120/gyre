<script lang="ts">
	import {
		SvelteFlow,
		Background,
		Controls,
		MiniMap,
		type Node,
		type Edge,
		type NodeTypes
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import ResourceNode from './ResourceNode.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { FluxResource } from '$lib/server/kubernetes/flux/types';

	let { nodes, edges }: { nodes: Node[]; edges: Edge[] } = $props();

	const nodeTypes: NodeTypes = {
		resource: ResourceNode
	};

	type CustomNodeData = {
		resource: FluxResource;
		label: string;
		kind: string;
		status: 'ready' | 'pending' | 'failed' | 'suspended';
	};

	function onNodeClick(node: Node) {
		const mapping: Record<string, string> = {
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

		const data = node.data as CustomNodeData;
		const kind = data.kind;
		const type = mapping[kind];
		const namespace = data.resource.metadata.namespace;
		const name = data.resource.metadata.name;

		if (type && namespace && name) {
			goto(resolve(`/resources/${type}/${namespace}/${name}`));
		}
	}
</script>

<div class="h-[600px] w-full rounded-xl border border-border bg-card shadow-inner">
	<SvelteFlow
		{nodes}
		{edges}
		{nodeTypes}
		fitView
		minZoom={0.1}
		onnodeclick={({ node }) => onNodeClick(node)}
	>
		<Background patternColor="currentColor" class="text-muted-foreground/20" gap={20} size={1} />
		<Controls />
		<MiniMap
			class="!border-border !bg-card"
			nodeColor={(n) => {
				const data = n.data as CustomNodeData;
				if (data.status === 'ready') return '#22c55e'; // green-500
				if (data.status === 'failed') return '#ef4444'; // red-500
				if (data.status === 'suspended') return '#71717a'; // zinc-500
				return '#eab308'; // yellow-500
			}}
		/>
	</SvelteFlow>
</div>
