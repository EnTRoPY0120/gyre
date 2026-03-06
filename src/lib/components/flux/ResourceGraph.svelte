<script lang="ts">
	import type { ResourceHealth, GraphNode } from '$lib/types/view';
	import { SvelteSet } from 'svelte/reactivity';

	interface Props {
		root: GraphNode;
	}

	let { root }: Props = $props();

	// --- Layout constants ---
	const NODE_W = 190;
	const NODE_H = 64;
	const H_GAP = 28;
	const V_GAP = 72;

	// --- Zoom / pan state ---
	let svgEl = $state<SVGSVGElement | null>(null);
	let transform = $state({ x: 40, y: 40, scale: 1 });
	let isPanning = $state(false);
	let panStart = $state({ x: 0, y: 0, tx: 0, ty: 0 });

	// Collapsed node IDs
	let collapsed = new SvelteSet<string>();

	// Selected node
	let selectedNode = $state<GraphNode | null>(null);

	// --- Layout computation ---
	interface LayoutNode {
		node: GraphNode;
		x: number;
		y: number;
		children: LayoutNode[];
	}

	function subtreeWidth(node: GraphNode): number {
		if (collapsed.has(node.id) || node.children.length === 0) return NODE_W;
		const total =
			node.children.reduce((s, c) => s + subtreeWidth(c), 0) +
			H_GAP * (node.children.length - 1);
		return Math.max(NODE_W, total);
	}

	function buildLayout(node: GraphNode, xOffset: number, depth: number): LayoutNode {
		const width = subtreeWidth(node);
		const cx = xOffset + width / 2;
		const cy = depth * (NODE_H + V_GAP);

		const layout: LayoutNode = {
			node,
			x: cx - NODE_W / 2,
			y: cy,
			children: []
		};

		if (!collapsed.has(node.id) && node.children.length > 0) {
			let childX = xOffset;
			for (const child of node.children) {
				const cw = subtreeWidth(child);
				layout.children.push(buildLayout(child, childX, depth + 1));
				childX += cw + H_GAP;
			}
		}

		return layout;
	}

	function collectNodes(layout: LayoutNode, out: LayoutNode[] = []): LayoutNode[] {
		out.push(layout);
		for (const c of layout.children) collectNodes(c, out);
		return out;
	}

	interface Edge {
		x1: number;
		y1: number;
		x2: number;
		y2: number;
	}

	function collectEdges(layout: LayoutNode, out: Edge[] = []): Edge[] {
		for (const c of layout.children) {
			out.push({
				x1: layout.x + NODE_W / 2,
				y1: layout.y + NODE_H,
				x2: c.x + NODE_W / 2,
				y2: c.y
			});
			collectEdges(c, out);
		}
		return out;
	}

	const layout = $derived(buildLayout(root, 0, 0));
	const allNodes = $derived(collectNodes(layout));
	const allEdges = $derived(collectEdges(layout));

	const canvasW = $derived(
		allNodes.reduce((m, n) => Math.max(m, n.x + NODE_W), 0) + 40
	);
	const canvasH = $derived(
		allNodes.reduce((m, n) => Math.max(m, n.y + NODE_H), 0) + 40
	);

	// --- Health colors ---
	const healthBg: Record<ResourceHealth, string> = {
		healthy: '#16a34a',
		progressing: '#d97706',
		failed: '#dc2626',
		suspended: '#6b7280',
		unknown: '#6b7280'
	};

	const healthBgLight: Record<ResourceHealth, string> = {
		healthy: '#f0fdf4',
		progressing: '#fffbeb',
		failed: '#fef2f2',
		suspended: '#f9fafb',
		unknown: '#f9fafb'
	};

	const healthBgDark: Record<ResourceHealth, string> = {
		healthy: '#14532d',
		progressing: '#451a03',
		failed: '#450a0a',
		suspended: '#1f2937',
		unknown: '#1f2937'
	};

	const healthText: Record<ResourceHealth, string> = {
		healthy: '#15803d',
		progressing: '#b45309',
		failed: '#b91c1c',
		suspended: '#4b5563',
		unknown: '#4b5563'
	};

	// Kind icons (emoji fallbacks for SVG)
	const kindIcon: Record<string, string> = {
		Kustomization: '⚙',
		HelmRelease: '⎈',
		Deployment: '📦',
		StatefulSet: '🗃',
		DaemonSet: '🔁',
		ReplicaSet: '📋',
		Pod: '🫙',
		Service: '🌐',
		ConfigMap: '📄',
		Secret: '🔑',
		ServiceAccount: '👤',
		Namespace: '📁',
		Ingress: '↗',
		PersistentVolumeClaim: '💾'
	};

	// --- Zoom / pan handlers ---
	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const factor = e.deltaY < 0 ? 1.1 : 0.9;
		const newScale = Math.max(0.2, Math.min(3, transform.scale * factor));

		// Zoom toward cursor
		const rect = svgEl!.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;

		transform = {
			x: mx - (mx - transform.x) * (newScale / transform.scale),
			y: my - (my - transform.y) * (newScale / transform.scale),
			scale: newScale
		};
	}

	function onMouseDown(e: MouseEvent) {
		if (e.button !== 0) return;
		isPanning = true;
		panStart = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
	}

	function onMouseMove(e: MouseEvent) {
		if (!isPanning) return;
		transform = {
			...transform,
			x: panStart.tx + (e.clientX - panStart.x),
			y: panStart.ty + (e.clientY - panStart.y)
		};
	}

	function onMouseUp() {
		isPanning = false;
	}

	function fitToView() {
		if (!svgEl || allNodes.length === 0) return;
		const rect = svgEl.getBoundingClientRect();
		const padding = 40;
		const scaleX = (rect.width - padding * 2) / canvasW;
		const scaleY = (rect.height - padding * 2) / canvasH;
		const scale = Math.min(scaleX, scaleY, 1);
		transform = {
			x: padding + (rect.width - padding * 2 - canvasW * scale) / 2,
			y: padding,
			scale
		};
	}

	// Fit to view on root change
	$effect(() => {
		// eslint-disable-next-line @typescript-eslint/no-unused-expressions
		root; // reactive dependency
		setTimeout(fitToView, 50);
	});

	function toggleCollapse(nodeId: string) {
		if (collapsed.has(nodeId)) {
			collapsed.delete(nodeId);
		} else {
			collapsed.add(nodeId);
		}
	}

	function selectNode(node: GraphNode, e: MouseEvent) {
		e.stopPropagation();
		selectedNode = selectedNode?.id === node.id ? null : node;
	}

	function conditionBadge(status: string) {
		if (status === 'True') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
		if (status === 'False') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
		return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
	}

	let isDark = $state(false);
	$effect(() => {
		isDark = window.matchMedia('(prefers-color-scheme: dark)').matches ||
			document.documentElement.classList.contains('dark');
	});
</script>

<div class="flex h-full flex-col gap-0">
	<!-- Toolbar -->
	<div
		class="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700"
	>
		<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
			<span>{allNodes.length} objects</span>
			<span>·</span>
			<span>Scroll to zoom · Drag to pan · Click node for details</span>
		</div>
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={fitToView}
				class="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
			>
				Fit to view
			</button>
			<button
				type="button"
				onclick={() => (transform = { ...transform, scale: Math.min(3, transform.scale * 1.2) })}
				class="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				aria-label="Zoom in"
			>
				＋
			</button>
			<button
				type="button"
				onclick={() => (transform = { ...transform, scale: Math.max(0.2, transform.scale * 0.8) })}
				class="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
				aria-label="Zoom out"
			>
				－
			</button>
		</div>
	</div>

	<!-- Main area: graph + detail panel -->
	<div class="flex min-h-0 flex-1">
		<!-- SVG canvas -->
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<svg
			bind:this={svgEl}
			class="flex-1 cursor-grab bg-gray-50 dark:bg-gray-900 {isPanning ? 'cursor-grabbing' : ''}"
			role="application"
			aria-label="Kubernetes object tree graph"
			onwheel={onWheel}
			onmousedown={onMouseDown}
			onmousemove={onMouseMove}
			onmouseup={onMouseUp}
			onmouseleave={onMouseUp}
			onclick={() => (selectedNode = null)}
			onkeydown={(e) => e.key === 'Escape' && (selectedNode = null)}
		>
			<defs>
				<marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
					<path d="M0,0 L0,6 L6,3 z" fill="#d1d5db" />
				</marker>
			</defs>

			<g transform="translate({transform.x},{transform.y}) scale({transform.scale})">
				<!-- Edges -->
				{#each allEdges as edge, i (i)}
					{@const mx = (edge.x1 + edge.x2) / 2}
					{@const my1 = edge.y1 + (edge.y2 - edge.y1) * 0.4}
					{@const my2 = edge.y1 + (edge.y2 - edge.y1) * 0.6}
					<path
						d="M{edge.x1},{edge.y1} C{edge.x1},{my1} {edge.x2},{my2} {edge.x2},{edge.y2}"
						fill="none"
						stroke="#d1d5db"
						stroke-width="1.5"
						class="dark:stroke-gray-600"
					/>
					<!-- suppress unused mx -->
					{#if false}{mx}{/if}
				{/each}

				<!-- Nodes -->
				{#each allNodes as ln (ln.node.id)}
					{@const n = ln.node}
					{@const isSelected = selectedNode?.id === n.id}
					{@const hasChildren = n.children.length > 0}
					{@const isCollapsed = collapsed.has(n.id)}
					{@const bg = isDark ? healthBgDark[n.health] : healthBgLight[n.health]}
					{@const border = healthBg[n.health]}
					{@const textCol = healthText[n.health]}
					{@const icon = kindIcon[n.kind] || '◆'}

					<!-- Node card -->
					<g
						transform="translate({ln.x},{ln.y})"
						role="button"
						tabindex="0"
						aria-label="{n.kind} {n.name}"
						onclick={(e) => selectNode(n, e)}
						onkeydown={(e) => e.key === 'Enter' && selectNode(n, e as unknown as MouseEvent)}
						style="cursor: pointer"
					>
						<!-- Background rect -->
						<rect
							width={NODE_W}
							height={NODE_H}
							rx="8"
							fill={bg}
							stroke={isSelected ? '#3b82f6' : border}
							stroke-width={isSelected ? 2.5 : 1.5}
							filter={isSelected ? 'drop-shadow(0 0 6px rgba(59,130,246,0.5))' : ''}
						/>

						<!-- Status stripe on left -->
						<rect x="0" y="0" width="4" height={NODE_H} rx="8" fill={border} />
						<rect x="0" y="8" width="4" height={NODE_H - 16} fill={border} />

						<!-- Icon -->
						<text
							x="18"
							y={NODE_H / 2 + 5}
							font-size="16"
							text-anchor="middle"
							dominant-baseline="middle"
							style="user-select: none"
						>
							{icon}
						</text>

						<!-- Kind label -->
						<text
							x="32"
							y="18"
							font-size="9"
							fill={textCol}
							font-weight="600"
							font-family="ui-monospace, monospace"
							style="user-select: none; text-transform: uppercase; letter-spacing: 0.05em"
						>
							{n.kind}
						</text>

						<!-- Resource name -->
						<text
							x="32"
							y="35"
							font-size="12"
							fill={isDark ? '#f3f4f6' : '#111827'}
							font-weight="500"
							font-family="ui-sans-serif, sans-serif"
							style="user-select: none"
						>
							{n.name.length > 18 ? n.name.slice(0, 17) + '…' : n.name}
						</text>

						<!-- Namespace (if different from root) -->
						{#if n.namespace && n.namespace !== root.namespace}
							<text
								x="32"
								y="50"
								font-size="9"
								fill={isDark ? '#9ca3af' : '#6b7280'}
								font-family="ui-sans-serif, sans-serif"
								style="user-select: none"
							>
								{n.namespace}
							</text>
						{/if}

						<!-- Health badge -->
						<text
							x={NODE_W - 10}
							y={NODE_H / 2 + 4}
							font-size="9"
							fill={textCol}
							font-weight="600"
							text-anchor="end"
							font-family="ui-sans-serif, sans-serif"
							style="user-select: none"
						>
							{n.health === 'healthy' ? '✓' : n.health === 'failed' ? '✗' : n.health === 'progressing' ? '◐' : '—'}
						</text>

						<!-- Collapse/expand toggle for nodes with children -->
						{#if hasChildren}
							<g
								role="button"
								tabindex="0"
								aria-label={isCollapsed ? 'Expand' : 'Collapse'}
								transform="translate({NODE_W / 2 - 8},{NODE_H - 2})"
								onclick={(e) => {
									e.stopPropagation();
									toggleCollapse(n.id);
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.stopPropagation();
										toggleCollapse(n.id);
									}
								}}
								style="cursor: pointer"
							>
								<circle cx="8" cy="6" r="7" fill={isDark ? '#374151' : '#e5e7eb'} />
								<text
									x="8"
									y="10"
									font-size="9"
									text-anchor="middle"
									fill={isDark ? '#d1d5db' : '#4b5563'}
									font-weight="bold"
									style="user-select: none"
								>
									{isCollapsed ? '+' : '−'}
								</text>
							</g>
						{/if}
					</g>
				{/each}
			</g>
		</svg>

		<!-- Detail panel -->
		{#if selectedNode}
			{@const n = selectedNode}
			<div
				class="w-72 shrink-0 overflow-y-auto border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
			>
				<div class="border-b border-gray-200 p-4 dark:border-gray-700">
					<div class="flex items-start justify-between">
						<div>
							<div class="font-mono text-xs font-semibold tracking-widest text-gray-400 uppercase">
								{n.kind}
							</div>
							<div class="mt-0.5 break-all font-semibold text-gray-900 dark:text-gray-100">
								{n.name}
							</div>
							{#if n.namespace}
								<div class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{n.namespace}</div>
							{/if}
						</div>
						<button
							type="button"
							onclick={() => (selectedNode = null)}
							class="rounded p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
							aria-label="Close panel"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>

					<!-- Health badge -->
					<span
						class="mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize {n.health ===
						'healthy'
							? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
							: n.health === 'failed'
								? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
								: n.health === 'progressing'
									? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
									: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}"
					>
						{n.health}
					</span>
				</div>

				<!-- Details -->
				{#if Object.keys(n.details).length > 0}
					<div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
						<h4 class="mb-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
							Details
						</h4>
						<dl class="space-y-1.5">
							{#each Object.entries(n.details) as [k, v] (k)}
								{#if v !== undefined && v !== null}
									<div class="flex items-start justify-between gap-2 text-xs">
										<dt class="font-medium text-gray-500 capitalize dark:text-gray-400">
											{k.replace(/([A-Z])/g, ' $1').toLowerCase()}
										</dt>
										<dd class="break-all text-right font-mono text-gray-900 dark:text-gray-100">
											{String(v)}
										</dd>
									</div>
								{/if}
							{/each}
						</dl>
					</div>
				{/if}

				<!-- Conditions -->
				{#if n.conditions.length > 0}
					<div class="px-4 py-3">
						<h4 class="mb-2 text-xs font-semibold text-gray-500 uppercase dark:text-gray-400">
							Conditions
						</h4>
						<div class="space-y-2">
							{#each n.conditions as cond (cond.type)}
								<div class="rounded-md border border-gray-100 p-2 dark:border-gray-700">
									<div class="flex items-center justify-between gap-2">
										<span class="text-xs font-medium text-gray-700 dark:text-gray-300">
											{cond.type}
										</span>
										<span
											class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold {conditionBadge(cond.status)}"
										>
											{cond.status}
										</span>
									</div>
									{#if cond.reason}
										<div class="mt-1 font-mono text-[10px] text-gray-500 dark:text-gray-400">
											{cond.reason}
										</div>
									{/if}
									{#if cond.message}
										<div class="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
											{cond.message}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Children count -->
				{#if n.children.length > 0}
					<div class="border-t border-gray-200 px-4 py-3 dark:border-gray-700">
						<div class="text-xs text-gray-500 dark:text-gray-400">
							{n.children.length} child resource{n.children.length !== 1 ? 's' : ''}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
