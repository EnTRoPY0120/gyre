import { listFluxResourcesForType } from '../services.js';
import type { ListOptions } from '$lib/server/kubernetes/client.js';

export function listResourceUseCase(params: {
	locals: App.Locals;
	query: ListOptions;
	resourceType: string;
}) {
	return listFluxResourcesForType(params);
}
