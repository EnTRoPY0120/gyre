import { resolveResourceRouteType } from '$lib/config/resources';
import { fetchWithRetry } from '$lib/utils/fetch';
import { logger } from '$lib/utils/logger.js';

interface K8sResourceItem {
	kind?: string;
	metadata: {
		name: string;
		namespace?: string;
	};
}

interface K8sResourceList {
	items?: K8sResourceItem[];
}

export interface ReferenceOption {
	key: string;
	kind: string;
	name: string;
	namespace?: string;
	label: string;
	searchText: string;
}

export interface ReferenceFetchResult {
	resources: ReferenceOption[];
	sawFailure: boolean;
}

export function getReferenceResourcesAfterFetch(
	result: ReferenceFetchResult,
	existingResources: ReferenceOption[]
): ReferenceOption[] {
	return result.resources.length > 0 || !result.sawFailure ? result.resources : existingResources;
}

export function isAbortError(error: unknown): boolean {
	return error instanceof DOMException
		? error.name === 'AbortError'
		: error instanceof Error && error.name === 'AbortError';
}

function buildOptionLabel(
	name: string,
	namespace: string | undefined,
	kind: string,
	includeKind: boolean
): string {
	const details = [namespace, includeKind ? kind : undefined].filter(Boolean);
	return details.length > 0 ? `${name} (${details.join(', ')})` : name;
}

async function fetchKindResources(
	kind: string,
	includeKindInLabel: boolean,
	signal: AbortSignal
): Promise<ReferenceOption[]> {
	const routeType = resolveResourceRouteType(kind);
	if (!routeType) throw new Error(`Unknown reference type: ${kind}`);

	const response = await fetchWithRetry(`/api/v1/flux/${routeType}`, { signal }, { maxRetries: 0 });
	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(
			`Failed to fetch ${routeType}: ${response.status} ${response.statusText} - ${errorBody}`
		);
	}

	const data = (await response.json()) as K8sResourceList;
	return (data.items ?? []).map((item) => {
		const optionKind = item.kind || kind;
		const optionNamespace = item.metadata.namespace;
		return {
			key: `${optionKind}:${optionNamespace || ''}:${item.metadata.name}`,
			kind: optionKind,
			name: item.metadata.name,
			namespace: optionNamespace,
			label: buildOptionLabel(item.metadata.name, optionNamespace, optionKind, includeKindInLabel),
			searchText: [item.metadata.name, optionNamespace, optionKind]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
		};
	});
}

export async function fetchReferenceResources(
	referenceTypes: string[],
	existingResources: ReferenceOption[],
	signal: AbortSignal
): Promise<ReferenceFetchResult> {
	const includeKindInLabel = referenceTypes.length > 1;
	const existingResourcesByKind = new Map<string, ReferenceOption[]>();
	for (const resource of existingResources) {
		const kindResources = existingResourcesByKind.get(resource.kind) ?? [];
		kindResources.push(resource);
		existingResourcesByKind.set(resource.kind, kindResources);
	}

	const fetchTargets = referenceTypes
		.filter((kind) => kind !== '*')
		.map((kind) => ({
			kind,
			promise: fetchKindResources(kind, includeKindInLabel, signal)
		}));
	const results = await Promise.allSettled(fetchTargets.map((target) => target.promise));
	const freshResourcesByKind = new Map<string, ReferenceOption[]>();
	let sawFailure = false;

	results.forEach((result, index) => {
		const { kind } = fetchTargets[index];
		if (result.status === 'fulfilled') {
			freshResourcesByKind.set(kind, result.value);
			return;
		}
		if (isAbortError(result.reason)) return;
		sawFailure = true;
		logger.error(
			result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
			'Failed to fetch resources:'
		);
	});

	const mergedResources = new Map<string, ReferenceOption>();
	for (const { kind } of fetchTargets) {
		const resources = freshResourcesByKind.get(kind) ?? existingResourcesByKind.get(kind) ?? [];
		for (const resource of resources) mergedResources.set(resource.key, resource);
	}

	return {
		resources: Array.from(mergedResources.values()).sort((a, b) => a.label.localeCompare(b.label)),
		sawFailure
	};
}
