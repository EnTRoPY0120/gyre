import { deleteFluxResourcesBatch, type DeleteItem } from '$lib/server/kubernetes/client.js';

export function batchDeleteUseCase(params: {
	concurrency?: number;
	items: DeleteItem[];
	locals: App.Locals;
}) {
	return deleteFluxResourcesBatch(params.items, params.locals.cluster, params.concurrency);
}
