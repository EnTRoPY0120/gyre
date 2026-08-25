<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { RefreshCw } from '@lucide/svelte';
import type { BatchAction, FailedBatchResource } from './bulk-actions';

	let {
		lastBatchResult,
		isProcessing,
		currentOperation,
		onRetryFailed
	}: {
		lastBatchResult: {
			action: BatchAction;
			failedResources: FailedBatchResource[];
		};
		isProcessing: boolean;
		currentOperation: BatchAction | null;
		onRetryFailed: () => void | Promise<void>;
	} = $props();
</script>

<div class="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
	<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
		<div>
			<p class="text-sm font-semibold text-foreground">
				Retry {lastBatchResult.failedResources.length} failed
				{lastBatchResult.failedResources.length === 1 ? ' resource' : ' resources'}
			</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Only the failed resources remain selected so you can retry the same action without rebuilding
				the selection.
			</p>
		</div>
		<Button variant="outline" size="sm" onclick={onRetryFailed} disabled={isProcessing}>
			<RefreshCw
				size={16}
				class={currentOperation === lastBatchResult.action ? 'animate-spin' : ''}
			/>
			<span class="ml-2">Retry Failed</span>
		</Button>
	</div>

	<div class="mt-4 space-y-2">
		{#each lastBatchResult.failedResources as failure (`${failure.resource.type}:${failure.resource.namespace}:${failure.resource.name}`)}
			<div class="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
				<div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
					<div>
						<p class="font-mono text-sm text-foreground">{failure.resource.name}</p>
						<p class="text-xs text-muted-foreground">
							Namespace: {failure.resource.namespace || 'cluster-scoped'}
						</p>
					</div>
					<p class="text-xs text-destructive">{failure.message}</p>
				</div>
			</div>
		{/each}
	</div>
</div>
