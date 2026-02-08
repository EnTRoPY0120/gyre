import dagre from 'dagre';
import { type Node, type Edge, MarkerType } from '@xyflow/svelte';
import type { ResourceRef, ResourceRelationship } from './relationships';
import type { FluxResource } from '$lib/server/kubernetes/flux/types';
import { getResourceStatus } from './relationships';

const NODE_WIDTH = 250;
const NODE_HEIGHT = 80;
const RANK_SEP = 100;
const NODE_SEP = 50;

export interface GraphData {
	nodes: Node[];
	edges: Edge[];
}

/**
 * Build a SvelteFlow graph from resources and relationships with auto-layout
 */
export function buildGraph(
	resources: FluxResource[],
	relationships: ResourceRelationship[],
	direction: 'LR' | 'TB' = 'LR'
): GraphData {
	const dagreGraph = new dagre.graphlib.Graph();
	dagreGraph.setDefaultEdgeLabel(() => ({}));

	dagreGraph.setGraph({
		rankdir: direction,
		align: 'UL', // Align Upper-Left
		nodesep: NODE_SEP,
		ranksep: RANK_SEP
	});

	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const resourceIds = new Set<string>();

	// 1. Create Nodes
	resources.forEach((resource) => {
		const id = getResourceId(resource);
		resourceIds.add(id);

		const status = getResourceStatus(resource);

		dagreGraph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });

		nodes.push({
			id,
			type: 'resource',
			data: {
				resource,
				label: resource.metadata.name,
				kind: resource.kind,
				status
			},
			position: { x: 0, y: 0 } // Position will be set by dagre
		});
	});

	// 2. Create Edges from Relationships
	relationships.forEach((rel, index) => {
		const sourceId = getRefId(rel.source);
		const targetId = getRefId(rel.target);

		// Only add edge if both nodes exist in the current graph
		if (resourceIds.has(sourceId) && resourceIds.has(targetId)) {
			dagreGraph.setEdge(sourceId, targetId);

			edges.push({
				id: `e-${index}`,
				source: sourceId,
				target: targetId,
				type: 'smoothstep', // Or 'default', 'straight'
				label: rel.label,
				style: 'stroke: var(--border); stroke-width: 2;',
				markerEnd: {
					type: MarkerType.ArrowClosed
				}
			});
		}
	});

	// 3. Compute Layout
	dagre.layout(dagreGraph);

	// 4. Apply positions to nodes
	const layoutNodes = nodes.map((node) => {
		const nodeWithPosition = dagreGraph.node(node.id);
		return {
			...node,
			position: {
				x: nodeWithPosition.x - NODE_WIDTH / 2,
				y: nodeWithPosition.y - NODE_HEIGHT / 2
			}
		};
	});

	return { nodes: layoutNodes, edges };
}

/**
 * Build a SvelteFlow graph focused on a specific resource and its dependencies/inventory
 */
export function buildResourceGraph(
	rootResource: FluxResource,
	inventoryResources: FluxResource[] = [],
	relationships: ResourceRelationship[] = []
): GraphData {
	const dagreGraph = new dagre.graphlib.Graph();
	dagreGraph.setDefaultEdgeLabel(() => ({}));

	dagreGraph.setGraph({
		rankdir: 'LR',
		align: 'UL',
		nodesep: NODE_SEP,
		ranksep: RANK_SEP
	});

	const nodes: Node[] = [];
	const edges: Edge[] = [];
	const addedNodeIds = new Set<string>();

	// 1. Add Root Node
	const rootId = getResourceId(rootResource);
	addedNodeIds.add(rootId);

	dagreGraph.setNode(rootId, { width: NODE_WIDTH, height: NODE_HEIGHT });
	nodes.push({
		id: rootId,
		type: 'resource',
		data: {
			resource: rootResource,
			label: rootResource.metadata.name,
			kind: rootResource.kind,
			status: getResourceStatus(rootResource)
		},
		position: { x: 0, y: 0 },
		style: 'border-width: 2px; border-color: var(--primary);' // Highlight root
	});

	// 2. Add Inventory Nodes (Children)
	inventoryResources.forEach((res, index) => {
		const id = getResourceId(res);
		// Avoid duplicate nodes if inventory contains the root itself (unlikely but possible)
		if (addedNodeIds.has(id)) return;

		addedNodeIds.add(id);
		dagreGraph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });

		nodes.push({
			id,
			type: 'resource',
			data: {
				resource: res,
				label: res.metadata.name,
				kind: res.kind,
				status: getResourceStatus(res) // Inventory items might not have status, default to pending/unknown logic
			},
			position: { x: 0, y: 0 }
		});

		// Edge from Root -> Inventory Item
		dagreGraph.setEdge(rootId, id);
		edges.push({
			id: `e-root-${index}`,
			source: rootId,
			target: id,
			type: 'smoothstep',
			label: 'manages',
			style: 'stroke: var(--border); stroke-width: 2;',
			markerEnd: { type: MarkerType.ArrowClosed }
		});
	});

	// 3. Add Relationship Nodes (Parents/Children from explicit relationships)
	// Filter relationships where root is source or target
	// We filter them to avoid lint errors for now, but we don't use them yet
	relationships.filter((rel) => {
		const sourceId = getRefId(rel.source);
		const targetId = getRefId(rel.target);
		return sourceId === rootId || targetId === rootId;
	});

	// 4. Compute Layout
	dagre.layout(dagreGraph);

	// 5. Apply positions
	const layoutNodes = nodes.map((node) => {
		const nodeWithPosition = dagreGraph.node(node.id);
		return {
			...node,
			position: {
				x: nodeWithPosition.x - NODE_WIDTH / 2,
				y: nodeWithPosition.y - NODE_HEIGHT / 2
			}
		};
	});

	return { nodes: layoutNodes, edges };
}

// Helper to generate consistent IDs
function getResourceId(resource: FluxResource): string {
	return `${resource.kind}:${resource.metadata.namespace || '_'}:${resource.metadata.name}`;
}

function getRefId(ref: ResourceRef): string {
	return `${ref.kind}:${ref.namespace || '_'}:${ref.name}`;
}
