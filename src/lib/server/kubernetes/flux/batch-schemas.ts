import { z } from '$lib/server/openapi';

export const batchResourceSchema = z.object({
	type: z.string().openapi({ example: 'GitRepository' }),
	namespace: z.string().openapi({ example: 'flux-system' }),
	name: z.string().openapi({ example: 'my-repo' })
});

export const batchResultSchema = z.object({
	resource: batchResourceSchema,
	success: z.boolean(),
	message: z.string()
});

export type BatchResourceItem = z.infer<typeof batchResourceSchema>;

export type BatchOperationResult = z.infer<typeof batchResultSchema>;
