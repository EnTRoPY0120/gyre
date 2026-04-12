<script lang="ts">
	import type { FluxResource } from '$lib/types/flux';
	import { Button } from '$lib/components/ui/button';
	import {
		AlertDialog,
		AlertDialogAction,
		AlertDialogCancel,
		AlertDialogContent,
		AlertDialogDescription,
		AlertDialogFooter,
		AlertDialogHeader,
		AlertDialogTitle
	} from '$lib/components/ui/alert-dialog';
	import { Pause, Play, RefreshCw, Trash2, X } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { getCsrfToken } from '$lib/utils/csrf';
	import {
		partitionBatchOperationResult,
		toBatchResourceItem,
		type BatchAction,
		type BatchOperationResponse,
		type FailedBatchResource
	} from './bulk-actions';

	interface Props {
		selectedResources: FluxResource[];
		onClearSelection: () => void;
		onSetSelection: (resources: FluxResource[]) => void;
		onOperationComplete?: () => void;
	}

	let { selectedResources, onClearSelection, onSetSelection, onOperationComplete }: Props = $props();

	let isProcessing = $state(false);
	let showDeleteDialog = $state(false);
	let currentOperation = $state<BatchAction | null>(null);
	let lastBatchResult = $state<{
		action: BatchAction;
		failedResources: FailedBatchResource[];
	} | null>(null);

	// Past tense verb map to avoid invalid words like "resumeed"
	const pastTenseMap: Record<BatchAction, string> = {
		suspend: 'suspended',
		resume: 'resumed',
		reconcile: 'reconciled',
		delete: 'deleted'
	};

	function getResourceKey(resource: FluxResource): string {
		return `${resource.kind || ''}:${resource.metadata.namespace || ''}:${resource.metadata.name || ''}`;
	}

	function selectionMatchesFailedResources(
		selection: FluxResource[],
		failedResources: FailedBatchResource[]
	): boolean {
		if (selection.length !== failedResources.length) {
			return false;
		}

		const selectedKeys = new Set(selection.map((resource) => getResourceKey(resource)));
		return failedResources.every((failure) => selectedKeys.has(getResourceKey(failure.originalResource)));
	}

	$effect(() => {
		if (!lastBatchResult) {
			return;
		}

		if (!selectionMatchesFailedResources(selectedResources, lastBatchResult.failedResources)) {
			lastBatchResult = null;
		}
	});

	async function performBatchOperation(
		action: BatchAction,
		resourcesToOperateOn: FluxResource[] = selectedResources
	) {
		if (resourcesToOperateOn.length === 0) return;

		isProcessing = true;
		currentOperation = action;

		const resources = resourcesToOperateOn.map((resource) => toBatchResourceItem(resource));

		const pastTense = pastTenseMap[action];

		try {
			const response = await fetch(`/api/v1/flux/batch/${action}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
				body: JSON.stringify({ resources })
			});

			if (!response.ok) {
				throw new Error(`Failed to ${action} resources`);
			}

			const data: BatchOperationResponse = await response.json();
			const result = partitionBatchOperationResult(resourcesToOperateOn, data);

			if (result.allSucceeded) {
				toast.success(`Successfully ${pastTense} ${data.summary.successful} resource(s)`, {
					description: 'All operations completed successfully'
				});
				lastBatchResult = null;
				onClearSelection();
			} else if (result.allFailed) {
				toast.error(`Failed to ${action} resources`, {
					description: `All ${data.summary.failed} operations failed`
				});
				lastBatchResult = {
					action,
					failedResources: result.failedResources
				};
				onSetSelection(result.nextSelectedResources);
			} else {
				toast.warning(`Partially completed ${action} operation`, {
					description: `${data.summary.successful} succeeded, ${data.summary.failed} failed`
				});
				lastBatchResult = {
					action,
					failedResources: result.failedResources
				};
				onSetSelection(result.nextSelectedResources);
			}

			if (onOperationComplete) {
				onOperationComplete();
			}
		} catch (err) {
			toast.error(`Error performing ${action} operation`, {
				description: err instanceof Error ? err.message : 'Unknown error'
			});
		} finally {
			isProcessing = false;
			currentOperation = null;
		}
	}

	async function handleSuspend() {
		await performBatchOperation('suspend');
	}

	async function handleResume() {
		await performBatchOperation('resume');
	}

	async function handleReconcile() {
		await performBatchOperation('reconcile');
	}

	async function handleRetryFailed() {
		if (!lastBatchResult || lastBatchResult.failedResources.length === 0) {
			return;
		}

		const resourcesToRetry = lastBatchResult.failedResources.map((failure) => failure.originalResource);
		await performBatchOperation(lastBatchResult.action, resourcesToRetry);
	}

	function handleDeleteClick() {
		showDeleteDialog = true;
	}

	async function handleDeleteConfirm() {
		showDeleteDialog = false;
		await performBatchOperation('delete');
	}

	const selectedCount = $derived(selectedResources.length);
</script>

<div
	class="fixed bottom-6 left-1/2 z-50 w-[min(92vw,56rem)] -translate-x-1/2 transform rounded-xl border border-border bg-card/95 px-6 py-4 shadow-2xl backdrop-blur-lg transition-all duration-300"
>
	<div class="space-y-4">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
			<div class="flex items-center gap-2 lg:border-r lg:border-border lg:pr-4">
				<span class="font-mono text-sm font-medium">
					{selectedCount}
					{selectedCount === 1 ? 'resource' : 'resources'} selected
				</span>
				<Button
					variant="ghost"
					size="sm"
					onclick={onClearSelection}
					disabled={isProcessing}
					aria-label="Clear selection"
				>
					<X size={16} />
				</Button>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={handleSuspend}
					disabled={isProcessing}
					aria-label="Suspend selected resources"
				>
					<Pause size={16} />
					<span class="ml-2">Suspend</span>
				</Button>

				<Button
					variant="outline"
					size="sm"
					onclick={handleResume}
					disabled={isProcessing}
					aria-label="Resume selected resources"
				>
					<Play size={16} />
					<span class="ml-2">Resume</span>
				</Button>

				<Button
					variant="outline"
					size="sm"
					onclick={handleReconcile}
					disabled={isProcessing}
					aria-label="Reconcile selected resources"
				>
					<RefreshCw size={16} class={currentOperation === 'reconcile' ? 'animate-spin' : ''} />
					<span class="ml-2">Reconcile</span>
				</Button>

				<Button
					variant="destructive"
					size="sm"
					onclick={handleDeleteClick}
					disabled={isProcessing}
					aria-label="Delete selected resources"
				>
					<Trash2 size={16} />
					<span class="ml-2">Delete</span>
				</Button>
			</div>
		</div>

		{#if lastBatchResult && lastBatchResult.failedResources.length > 0}
			<div class="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4">
				<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
					<div>
						<p class="text-sm font-semibold text-foreground">
							Retry {lastBatchResult.failedResources.length} failed
							{lastBatchResult.failedResources.length === 1 ? ' resource' : ' resources'}
						</p>
						<p class="mt-1 text-sm text-muted-foreground">
							Only the failed resources remain selected so you can retry the same action
							without rebuilding the selection.
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onclick={handleRetryFailed}
						disabled={isProcessing}
					>
						<RefreshCw size={16} class={currentOperation ? 'animate-spin' : ''} />
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
		{/if}
	</div>
</div>

<AlertDialog bind:open={showDeleteDialog}>
	<AlertDialogContent>
		<AlertDialogHeader>
			<AlertDialogTitle>Delete {selectedCount} resource(s)?</AlertDialogTitle>
			<AlertDialogDescription>
				This action cannot be undone. This will permanently delete the selected FluxCD resources
				from your cluster.
			</AlertDialogDescription>
		</AlertDialogHeader>
		<AlertDialogFooter>
			<AlertDialogCancel>Cancel</AlertDialogCancel>
			<AlertDialogAction onclick={handleDeleteConfirm}>Delete</AlertDialogAction>
		</AlertDialogFooter>
	</AlertDialogContent>
</AlertDialog>

{#if isProcessing}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-background/50 backdrop-blur-sm"
	>
		<div class="rounded-lg border border-border bg-card p-6 shadow-xl">
			<div class="flex items-center gap-3">
				<RefreshCw size={20} class="animate-spin text-primary" />
				<p class="text-sm font-medium">
					Processing {currentOperation} operation...
				</p>
			</div>
		</div>
	</div>
{/if}
