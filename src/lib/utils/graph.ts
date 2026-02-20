import dagre from 'dagre';
import { type Node, type Edge, MarkerType } from '@xyflow/svelte';
import type { ResourceRef, ResourceRelationship } from './relationships';
import type { FluxResource } from '$lib/server/kubernetes/flux/types';
import { getResourceStatus, detectCircularDependencies } from './relationships';

const NODE_WIDTH = 260;
const NODE_HEIGHT = 72;
const RANK_SEP = 120;
const NODE_SEP = 40;

export interface GraphData {
	nodes: Node[];
	edges: Edge[];
}

/** Edge style config per relationship type */
const EDGE_STYLES: Record<string, { color: string; dashed?: boolean }> = {
	source: { color: '#3b82f6' },
	manages: { color: '#a855f7' },
	uses: { color: '#14b8a6' },
	triggers: { color: '#f97316' },
	notifies: { color: '#ec4899' }
};

/** Kind-specific accent colors */
export const KIND_COLORS: Record<string, string> = {
	GitRepository: '#3b82f6',
	HelmRepository: '#8b5cf6',
	HelmChart: '#6366f1',
	Bucket: '#06b6d4',
	OCIRepository: '#0ea5e9',
	Kustomization: '#f59e0b',
	HelmRelease: '#10b981',
	Alert: '#ef4444',
	Provider: '#f97316',
	Receiver: '#ec4899',
	ImageRepository: '#84cc16',
	ImagePolicy: '#14b8a6',
	ImageUpdateAutomation: '#a78bfa'
};

/**
 * Build a cluster-wide graph from all resources and relationships.
 * Uses dagre for hierarchical LR layout.
 */
export function buildGraph(
	resources: FluxResource[],
	relationships: ResourceRelationship[],
	options: {
		direction?: 'LR' | 'TB';
		hiddenKinds?: Set<string>;
		showOnlyFailed?: boolean;
		circularIds?: string[];
	} = {}
): GraphData {
	const { direction = 'LR', hiddenKinds = new Set(), showOnlyFailed = false } = options;

	const dagreGraph = new dagre.graphlib.Graph();
	dagreGraph.setDefaultEdgeLabel(() => ({}));
	dagreGraph.setGraph({ rankdir: direction, nodesep: NODE_SEP, ranksep: RANK_SEP });

	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const resourceIdSet = new Set<string>();

	const circularIds = options.circularIds ?? detectCircularDependencies(relationships);
	const circularSet = new Set(
		circularIds.map((id) => {
			// Convert resourceRefKey format (Kind/ns/name) to node id format (Kind:ns:name)
			const parts = id.split('/');
			return parts.length === 3 ? `${parts[0]}:${parts[1]}:${parts[2]}` : id;
		})
	);

	// Filter resources by kind/status
	const filtered = resources.filter((r) => {
		if (hiddenKinds.has(r.kind || '')) return false;
		if (showOnlyFailed) {
			const s = getResourceStatus(r);
			return s === 'failed' || s === 'suspended';
		}
		return true;
	});

	// Build nodes
	filtered.forEach((resource) => {
		const id = getResourceId(resource);
		resourceIdSet.add(id);
		dagreGraph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });

		nodes.push({
			id,
			type: 'resource',
			data: {
				resource,
				label: resource.metadata.name,
				kind: resource.kind || 'Unknown',
				namespace: resource.metadata.namespace,
				status: getResourceStatus(resource),
				isCircular: circularSet.has(id),
				kindColor: KIND_COLORS[resource.kind || ''] || '#6b7280'
			},
			position: { x: 0, y: 0 }
		});
	});

	// Build edges — only between visible nodes, deduped
	const seenEdges = new Set<string>();
	relationships.forEach((rel, index) => {
		const srcId = getRefId(rel.source);
		const tgtId = getRefId(rel.target);
		if (!resourceIdSet.has(srcId) || !resourceIdSet.has(tgtId)) return;

		const key = `${srcId}||${tgtId}`;
		if (seenEdges.has(key)) return;
		seenEdges.add(key);

		const style = EDGE_STYLES[rel.type] || { color: '#6b7280' };
		const isDashed = rel.label === 'depends on';

		try {
			dagreGraph.setEdge(srcId, tgtId, {});
		} catch {
			// Ignore multigraph errors
		}

		edges.push({
			id: `e-${index}`,
			source: srcId,
			target: tgtId,
			type: 'smoothstep',
			label: rel.label,
			animated: rel.type === 'triggers',
			style: `stroke: ${style.color}; stroke-width: 2;${isDashed ? ' stroke-dasharray: 6 3;' : ''}`,
			labelStyle: `font-size: 10px; fill: ${style.color}; font-weight: 500;`,
			markerEnd: { type: MarkerType.ArrowClosed, color: style.color, width: 16, height: 16 }
		});
	});

	dagre.layout(dagreGraph);

	const layoutNodes = nodes.map((node) => {
		const pos = dagreGraph.node(node.id);
		return {
			...node,
			position: {
				x: pos ? pos.x - NODE_WIDTH / 2 : 0,
				y: pos ? pos.y - NODE_HEIGHT / 2 : 0
			}
		};
	});

	return { nodes: layoutNodes, edges };
}

/**
 * Build a per-resource graph: root → sources → inventory/managed resources.
 * Shows dependsOn relationships when present.
 */
export function buildResourceGraph(
	rootResource: FluxResource,
	inventoryResources: FluxResource[] = [],
	relationships: ResourceRelationship[] = []
): GraphData {
	const dagreGraph = new dagre.graphlib.Graph();
	dagreGraph.setDefaultEdgeLabel(() => ({}));
	dagreGraph.setGraph({ rankdir: 'LR', nodesep: NODE_SEP, ranksep: RANK_SEP });

	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const addedIds = new Set<string>();
	const seenEdges = new Set<string>();

	const circularIds = detectCircularDependencies(relationships);
	const circularSet = new Set(
		circularIds.map((id) => {
			const parts = id.split('/');
			return parts.length === 3 ? `${parts[0]}:${parts[1]}:${parts[2]}` : id;
		})
	);

	const rootId = getResourceId(rootResource);

	// Index all provided resources for lookup
	const resById = new Map<string, FluxResource>();
	for (const res of inventoryResources) {
		resById.set(getResourceId(res), res);
	}

	function addNode(resource: FluxResource, isRoot = false) {
		const id = getResourceId(resource);
		if (addedIds.has(id)) return id;
		addedIds.add(id);
		dagreGraph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });

		nodes.push({
			id,
			type: 'resource',
			data: {
				resource,
				label: resource.metadata.name,
				kind: resource.kind || 'Unknown',
				namespace: resource.metadata.namespace,
				status: getResourceStatus(resource),
				isRoot,
				isCircular: circularSet.has(id),
				kindColor: KIND_COLORS[resource.kind || ''] || '#6b7280'
			},
			position: { x: 0, y: 0 },
			...(isRoot && { style: 'border-color: hsl(var(--primary)); border-width: 2px;' })
		});

		return id;
	}

	function addEdge(
		srcId: string,
		tgtId: string,
		relType: ResourceRelationship['type'],
		label?: string
	) {
		const key = `${srcId}||${tgtId}`;
		if (seenEdges.has(key)) return;
		seenEdges.add(key);

		const style = EDGE_STYLES[relType] || { color: '#6b7280' };
		const isDashed = label === 'depends on';

		try {
			dagreGraph.setEdge(srcId, tgtId, {});
		} catch {
			// Ignore
		}

		edges.push({
			id: `e-${srcId}-${tgtId}`,
			source: srcId,
			target: tgtId,
			type: 'smoothstep',
			label,
			animated: relType === 'triggers',
			style: `stroke: ${style.color}; stroke-width: 2;${isDashed ? ' stroke-dasharray: 6 3;' : ''}`,
			labelStyle: `font-size: 10px; fill: ${style.color}; font-weight: 500;`,
			markerEnd: { type: MarkerType.ArrowClosed, color: style.color, width: 16, height: 16 }
		});
	}

	// Add root
	addNode(rootResource, true);

	// Add relationships where root is source or target
	for (const rel of relationships) {
		const srcId = getRefId(rel.source);
		const tgtId = getRefId(rel.target);

		if (srcId === rootId) {
			// Root → something (e.g. Kustomization → GitRepository)
			const target = resById.get(tgtId);
			if (target) {
				addNode(target);
			} else {
				// Phantom node: referenced but not loaded
				if (!addedIds.has(tgtId)) {
					addedIds.add(tgtId);
					dagreGraph.setNode(tgtId, { width: NODE_WIDTH, height: NODE_HEIGHT });
					nodes.push({
						id: tgtId,
						type: 'resource',
						data: {
							resource: {
								kind: rel.target.kind,
								metadata: { name: rel.target.name, namespace: rel.target.namespace }
							} as FluxResource,
							label: rel.target.name,
							kind: rel.target.kind,
							namespace: rel.target.namespace,
							status: 'pending' as const,
							isPhantom: true,
							kindColor: KIND_COLORS[rel.target.kind] || '#6b7280'
						},
						position: { x: 0, y: 0 }
					});
				}
			}
			addEdge(rootId, tgtId, rel.type, rel.label);
		} else if (tgtId === rootId) {
			// Something → root (e.g. Receiver → Kustomization)
			const source = resById.get(srcId);
			if (source) {
				addNode(source);
				addEdge(srcId, rootId, rel.type, rel.label);
			}
		}
	}

	// Add inventory (managed resources) with "manages" edges
	inventoryResources.forEach((res) => {
		const id = getResourceId(res);
		addNode(res);
		addEdge(rootId, id, 'manages', 'manages');
	});

	dagre.layout(dagreGraph);

	const layoutNodes = nodes.map((node) => {
		const pos = dagreGraph.node(node.id);
		return {
			...node,
			position: {
				x: pos ? pos.x - NODE_WIDTH / 2 : 0,
				y: pos ? pos.y - NODE_HEIGHT / 2 : 0
			}
		};
	});

	return { nodes: layoutNodes, edges };
}

function getResourceId(resource: FluxResource): string {
	return `${resource.kind}:${resource.metadata.namespace || '_'}:${resource.metadata.name}`;
}

function getRefId(ref: ResourceRef): string {
	return `${ref.kind}:${ref.namespace || '_'}:${ref.name}`;
}
