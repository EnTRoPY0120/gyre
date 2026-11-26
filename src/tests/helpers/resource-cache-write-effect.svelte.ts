/** Start a client effect without mounting an unrelated UI component. */
export function runCacheEffect(write: () => void): () => void {
	return $effect.root(() => {
		$effect(write);
	});
}
