<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { FluxResource } from '$lib/server/kubernetes/flux/types';

	const KIND_ABBREV: Record<string, string> = {
		GitRepository: 'GR',
		HelmRepository: 'HR',
		HelmChart: 'HC',
		Bucket: 'BK',
		OCIRepository: 'OCI',
		Kustomization: 'KS',
		HelmRelease: 'HL',
		Alert: 'AL',
		Provider: 'PR',
		Receiver: 'RC',
		ImageRepository: 'IR',
		ImagePolicy: 'IP',
		ImageUpdateAutomation: 'IU'
	};

	// Simplified 24×24 SVG path data per kind
	const KIND_ICONS: Record<string, string> = {
		GitRepository:
			'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4',
		HelmRepository:
			'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
		HelmChart:
			'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
		Bucket: 'M3 6h18l-2 13H5L3 6ZM8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
		OCIRepository: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
		Kustomization: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
		HelmRelease:
			'M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3M12 15l-3 3 3 3m6-3H9',
		Alert:
			'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
		Provider:
			'M4.9 19.1C1 15.2 1 8.8 4.9 4.9M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5m8.4 8.4c2.3-2.3 2.3-6.1 0-8.5m2.9 11.4c3.9-3.9 3.9-10.3 0-14.2M12 12h.01',
		Receiver:
			'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.07 3.4 2 2 0 0 1 3.03 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z',
		ImageRepository: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
		ImagePolicy: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
		ImageUpdateAutomation:
			'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16m0 5v-5h5'
	};

	const STATUS_CONFIG = {
		ready: { dot: '#22c55e', border: 'border-green-500/30' },
		failed: { dot: '#ef4444', border: 'border-red-500/40' },
		suspended: { dot: '#f59e0b', border: 'border-amber-500/30' },
		pending: { dot: '#6b7280', border: 'border-zinc-500/20' }
	};

	let {
		data
	}: {
		data: {
			resource: FluxResource;
			label: string;
			kind: string;
			namespace?: string;
			status: 'ready' | 'pending' | 'failed' | 'suspended';
			isRoot?: boolean;
			isCircular?: boolean;
			isPhantom?: boolean;
			kindColor: string;
		};
	} = $props();

	const cfg = $derived(STATUS_CONFIG[data.status] ?? STATUS_CONFIG.pending);
	const abbrev = $derived(KIND_ABBREV[data.kind] ?? data.kind.slice(0, 3).toUpperCase());
	const iconPath = $derived(KIND_ICONS[data.kind] ?? '');
	const displayName = $derived(
		data.label.length > 20 ? data.label.slice(0, 19) + '\u2026' : data.label
	);
	const displayNs = $derived(
		data.namespace && data.namespace !== 'cluster-scoped' && data.namespace !== '_'
			? data.namespace.length > 14
				? data.namespace.slice(0, 13) + '\u2026'
				: data.namespace
			: null
	);
</script>

<Handle
	type="target"
	position={Position.Left}
	style="background: {data.kindColor}; width: 8px; height: 8px; border: 2px solid hsl(var(--background));"
/>

<div
	class="group relative flex w-[260px] cursor-pointer items-stretch overflow-hidden rounded-xl border bg-card shadow-md transition-all duration-150 hover:shadow-lg hover:ring-2 hover:ring-primary/30 {cfg.border} {data.isCircular ? '!border-red-500 ring-2 ring-red-500/50' : ''} {data.isPhantom ? 'opacity-60 saturate-50' : ''}"
>
	<!-- Kind accent sidebar -->
	<div
		class="flex w-11 flex-shrink-0 flex-col items-center justify-center gap-1.5 py-3"
		style="background: linear-gradient(180deg, {data.kindColor}22 0%, {data.kindColor}0a 100%);"
	>
		<!-- Kind icon -->
		<div
			class="flex h-7 w-7 items-center justify-center rounded-lg"
			style="background-color: {data.kindColor}28;"
		>
			{#if iconPath}
				<svg
					viewBox="0 0 24 24"
					class="h-4 w-4"
					fill="none"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					style="stroke: {data.kindColor};"
				>
					<path d={iconPath} />
				</svg>
			{:else}
				<span class="text-[9px] font-black" style="color: {data.kindColor};">{abbrev}</span>
			{/if}
		</div>
		<!-- Status indicator -->
		<div
			class="h-2 w-2 rounded-full shadow-sm"
			style="background-color: {cfg.dot}; box-shadow: 0 0 6px {cfg.dot}80;"
			title={data.status}
		></div>
	</div>

	<!-- Main content -->
	<div class="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-2.5 pr-3 pl-2">
		<div class="flex items-center gap-1">
			{#if data.isCircular}
				<span class="text-[11px] leading-none text-red-500" title="Circular dependency">⚠</span>
			{/if}
			<span
				class="truncate text-[13px] font-semibold leading-snug text-foreground"
				title={data.label}
			>
				{displayName}
			</span>
		</div>

		<div class="flex items-center gap-1.5">
			<span
				class="rounded px-1 py-0.5 font-mono text-[10px] font-medium leading-none"
				style="color: {data.kindColor}; background-color: {data.kindColor}18;"
			>
				{data.kind}
			</span>
			{#if displayNs}
				<span class="truncate text-[10px] text-muted-foreground" title={data.namespace}>
					{displayNs}
				</span>
			{/if}
			{#if data.isPhantom}
				<span class="text-[9px] italic text-muted-foreground/50">external</span>
			{/if}
		</div>
	</div>

	<!-- Status stripe on right edge -->
	<div
		class="absolute top-0 right-0 bottom-0 w-0.5 rounded-r-xl"
		style="background-color: {cfg.dot};"
	></div>
</div>

<Handle
	type="source"
	position={Position.Right}
	style="background: {data.kindColor}; width: 8px; height: 8px; border: 2px solid hsl(var(--background));"
/>
