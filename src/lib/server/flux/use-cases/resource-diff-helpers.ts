import { FLUX_RESOURCES } from '$lib/server/kubernetes/flux/resources';

export type DesiredResourceComparison = {
	kind: string;
	name: string;
	namespace: string;
	group: string;
	version: string;
	plural: string;
};

function pluralForKind(kind: string): string {
	const fluxDefs = Object.values(FLUX_RESOURCES) as Array<{ kind: string; plural: string }>;
	const fluxDef = fluxDefs.find((resource) => resource.kind === kind);
	if (fluxDef) return fluxDef.plural;

	let plural = `${kind.toLowerCase()}s`;
	if (kind.toLowerCase().endsWith('y')) plural = `${kind.toLowerCase().slice(0, -1)}ies`;
	else if (kind.toLowerCase().endsWith('s')) plural = `${kind.toLowerCase()}es`;
	if (kind === 'Ingress') plural = 'ingresses';
	if (kind === 'Endpoints') plural = 'endpoints';
	return plural;
}

export function getDesiredResourceComparison(
	desired: Record<string, unknown>,
	params: { namespace: string; spec: Record<string, unknown> }
): DesiredResourceComparison | null {
	if (!desired || typeof desired.kind !== 'string' || !desired.metadata) return null;
	if (typeof desired.metadata !== 'object' || desired.metadata === null) return null;

	const metadata = desired.metadata as { name?: unknown; namespace?: unknown };
	const apiVersion = typeof desired.apiVersion === 'string' ? desired.apiVersion : '';
	if (typeof metadata.name !== 'string' || !apiVersion) return null;

	const [group, version] = apiVersion.includes('/') ? apiVersion.split('/') : ['', apiVersion];
	const targetNamespace =
		typeof params.spec.targetNamespace === 'string' ? params.spec.targetNamespace : undefined;

	return {
		kind: desired.kind,
		name: metadata.name,
		namespace:
			(typeof metadata.namespace === 'string' && metadata.namespace) ||
			targetNamespace ||
			params.namespace,
		group,
		version,
		plural: pluralForKind(desired.kind)
	};
}
