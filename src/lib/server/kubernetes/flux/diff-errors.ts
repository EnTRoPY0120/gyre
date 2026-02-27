export type DiffErrorResponse = { status: number; message: string };

export function classifyDiffError(err: unknown): DiffErrorResponse {
	const message = err instanceof Error ? err.message : String(err);

	if (message.includes('not in gzip format')) {
		return {
			status: 500,
			message:
				'The artifact downloaded from source-controller is not a valid gzip archive. ' +
				'This usually indicates the source-controller service is returning an error page instead of the artifact. ' +
				'Check that the source-controller is running and the GitRepository/Bucket has reconciled successfully.'
		};
	} else if (message.includes('tar:')) {
		return {
			status: 500,
			message: 'Failed to extract source artifact. Check server logs for details.'
		};
	} else if (message.includes('kustomize')) {
		return {
			status: 500,
			message: 'Kustomize build failed. Check server logs for details.'
		};
	} else if (message.includes('timeout')) {
		return {
			status: 504,
			message:
				'Operation timed out. The kustomization may be too large or the source artifact is unavailable.'
		};
	}

	return {
		status: 500,
		message: 'Failed to compute diff. Please try again or check the source artifact.'
	};
}
